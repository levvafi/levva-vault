// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import {Math} from '@openzeppelin/contracts/utils/math/Math.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';

import {IMarginlyPool} from './IMarginlyPool.sol';
import {Errors} from '../../libraries/Errors.sol';
import {ConfigManagerStorage} from '../../base/ConfigManagerStorage.sol';
import {ILendingAdapter} from '../../interfaces/ILendingAdapter.sol';
import {MarginlyAdapterConfigStorage} from './MarginlyAdapterConfigStorage.sol';
import {IVault} from '../../interfaces/IVault.sol';
import {FP96} from './FP96.sol';

/// @title MarginlyAdapter
/// @notice Adapter contract for interacting with Marginly pools
/// @dev Implements the ILendingAdapter interface and manages interactions with Marginly pools
contract MarginlyAdapter is ConfigManagerStorage, ILendingAdapter {
  using FP96 for FP96.FixedPoint;
  using SafeERC20 for IERC20;
  using Math for uint256;

  uint256 private constant SECONDS_IN_YEAR_X96 = 2500250661360148260042022567123353600;
  uint256 private constant X96_ONE = 2 ** 96;
  uint24 private constant WHOLE_ONE = 1e6;

  /// @notice Deposits an amount into a Marginly pool
  function deposit(address pool, uint256 amount) external returns (uint256) {
    MarginlyAdapterConfigStorage.PoolConfig memory config = MarginlyAdapterConfigStorage(_getConfigManager())
      .getPoolConfigByAddress(address(this), pool);

    if (config.pool == address(0)) revert Errors.UnknownPool();

    IERC20(IERC4626(address(this)).asset()).forceApprove(pool, amount);
    _marginlyExecute(
      pool,
      config.isQuote ? IMarginlyPool.CallType.DepositQuote : IMarginlyPool.CallType.DepositBase,
      amount
    );

    return amount;
  }

  /// @notice Withdraws an exact amount or the maximum possible amount from a Marginly pool
  function withdraw(address pool, uint256 amount) external returns (uint256) {
    MarginlyAdapterConfigStorage.PoolConfig memory config = MarginlyAdapterConfigStorage(_getConfigManager())
      .getPoolConfigByAddress(address(this), pool);

    if (config.pool == address(0)) revert Errors.UnknownPool();

    address asset = IERC4626(address(this)).asset();
    uint256 withdrawn = IERC20(asset).balanceOf(address(this));
    _marginlyExecute(
      pool,
      config.isQuote ? IMarginlyPool.CallType.WithdrawQuote : IMarginlyPool.CallType.WithdrawBase,
      amount
    );

    withdrawn = IERC20(asset).balanceOf(address(this)) - withdrawn;
    return withdrawn;
  }

  function getLentAmount(address vault) public view returns (uint256) {
    address configManager = IVault(vault).getConfigManager();
    MarginlyAdapterConfigStorage configStorage = MarginlyAdapterConfigStorage(configManager);
    uint32 countOfPools = configStorage.getCountOfPools(vault);
    uint32 i;
    uint256 totalLent;
    for (; i < countOfPools; ) {
      MarginlyAdapterConfigStorage.PoolConfig memory config = configStorage.getPoolConfigByIndex(vault, i);
      IMarginlyPool.Position memory position = IMarginlyPool(config.pool).positions(vault);
      if (position._type == IMarginlyPool.PositionType.Lend) {
        FP96.FixedPoint memory collateralCoeff = _estimateCollateralCoeff(IMarginlyPool(config.pool), config.isQuote);

        totalLent += config.isQuote
          ? position.discountedQuoteAmount.mulDiv(collateralCoeff.inner, X96_ONE)
          : position.discountedBaseAmount.mulDiv(collateralCoeff.inner, X96_ONE);
      }

      unchecked {
        ++i;
      }
    }

    return totalLent;
  }

  /// @dev Executes a Marginly pool operation
  /// @param pool The address of the Marginly pool
  /// @param callType The type of operation to execute
  /// @param amount The amount involved in the operation
  function _marginlyExecute(address pool, IMarginlyPool.CallType callType, uint256 amount) internal {
    IMarginlyPool(pool).execute(
      callType,
      amount, // amount of deposit/withdraw
      int256(0), // amount2 is not used in deposit/withdraw
      0, // limitPriceX96  is not used in deposit/withdraw
      false, // flag is not used in deposit/withdraw
      address(0), // receive position address is not used in deposit/withdraw
      0 // swap call data is not used
    );
  }

  /// @dev A little modified MarginlyPool.accruedInterest() function
  /// @dev https://github.com/eq-lab/marginly/blob/main/packages/contracts/contracts/MarginlyPool.sol#L1019
  /// @dev Instead of calling MarginlyPool.reinit() we make calculations on our side
  /// @dev Reinit simulation without margin calls
  function _estimateCollateralCoeff(IMarginlyPool pool, bool isQuote) private view returns (FP96.FixedPoint memory) {
    uint256 secondsPassed = block.timestamp - pool.lastReinitTimestampSeconds();
    if (secondsPassed == 0) {
      return isQuote ? pool.quoteCollateralCoeff() : pool.baseCollateralCoeff();
    }

    IMarginlyPool.MarginlyParams memory params = pool.params();

    FP96.FixedPoint memory secondsInYear = FP96.FixedPoint({inner: SECONDS_IN_YEAR_X96});
    FP96.FixedPoint memory interestRate = FP96.fromRatio(params.interestRate, WHOLE_ONE);

    if (isQuote) {
      FP96.FixedPoint memory quoteCollateralCoeff = pool.quoteCollateralCoeff();
      FP96.FixedPoint memory quoteDebtCoeffPrev = pool.quoteDebtCoeff();
      FP96.FixedPoint memory systemLeverage = FP96.FixedPoint({inner: pool.systemLeverage().longX96});
      FP96.FixedPoint memory onePlusIR = interestRate.mul(systemLeverage).div(secondsInYear).add(FP96.one());

      // AR(dt) =  (1 + ir)^dt
      FP96.FixedPoint memory accruedRateDt = FP96.powTaylor(onePlusIR, secondsPassed);

      uint256 realQuoteDebtPrev = quoteDebtCoeffPrev.mul(pool.discountedQuoteDebt());
      uint256 realQuoteDebt = accruedRateDt.sub(FP96.one()).mul(realQuoteDebtPrev);
      uint256 realQuoteCollateral = quoteCollateralCoeff.mul(pool.discountedQuoteCollateral()) -
        pool.quoteDelevCoeff().mul(pool.discountedBaseDebt());

      FP96.FixedPoint memory factor = FP96.one().add(FP96.fromRatio(realQuoteDebt, realQuoteCollateral));

      return quoteCollateralCoeff.mul(factor);
    } else {
      FP96.FixedPoint memory baseCollateralCoeff = pool.baseCollateralCoeff();
      FP96.FixedPoint memory baseDebtCoeffPrev = pool.baseDebtCoeff();
      FP96.FixedPoint memory systemLeverage = FP96.FixedPoint({inner: pool.systemLeverage().shortX96});
      FP96.FixedPoint memory onePlusIR = interestRate.mul(systemLeverage).div(secondsInYear).add(FP96.one());

      // AR(dt) =  (1 + ir)^dt
      FP96.FixedPoint memory accruedRateDt = FP96.powTaylor(onePlusIR, secondsPassed);

      uint256 realBaseDebtPrev = baseDebtCoeffPrev.mul(pool.discountedBaseDebt());
      uint256 realBaseDebt = accruedRateDt.sub(FP96.one()).mul(realBaseDebtPrev);
      uint256 realBaseCollateral = baseCollateralCoeff.mul(pool.discountedBaseCollateral()) -
        pool.baseDelevCoeff().mul(pool.discountedQuoteDebt());

      FP96.FixedPoint memory factor = FP96.one().add(FP96.fromRatio(realBaseDebt, realBaseCollateral));

      return baseCollateralCoeff.mul(factor);
    }
  }
}
