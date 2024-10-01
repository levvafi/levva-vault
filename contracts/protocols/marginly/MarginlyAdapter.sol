// SPDX-License-Identifier: GPL-3.0
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

/// @title MarginlyAdapter
/// @notice Adapter contract for interacting with Marginly pools
/// @dev Implements the ILendingAdapter interface and manages interactions with Marginly pools
contract MarginlyAdapter is ConfigManagerStorage, ILendingAdapter {
  using SafeERC20 for IERC20;
  using Math for uint256;

  uint256 constant X96_ONE = 2 ** 96;

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

  /// @notice Updates the total lent amount across all pools
  /// @return The total lent amount
  function updateLentAmount() external returns (uint256) {
    MarginlyAdapterConfigStorage configStorage = MarginlyAdapterConfigStorage(_getConfigManager());
    uint32 countOfPools = configStorage.getCountOfPools(address(this));
    uint32 i;
    uint256 totalLent;
    for (; i < countOfPools; ) {
      MarginlyAdapterConfigStorage.PoolConfig memory config = configStorage.getPoolConfigByIndex(address(this), i);
      IMarginlyPool.Position memory position = IMarginlyPool(config.pool).positions(address(this));
      if (position._type == IMarginlyPool.PositionType.Lend) {
        _marginlyExecute(config.pool, IMarginlyPool.CallType.Reinit, 0);

        totalLent += config.isQuote
          ? position.discountedQuoteAmount.mulDiv(IMarginlyPool(config.pool).quoteCollateralCoeff(), X96_ONE)
          : position.discountedBaseAmount.mulDiv(IMarginlyPool(config.pool).baseCollateralCoeff(), X96_ONE);
      }

      unchecked {
        ++i;
      }
    }

    return totalLent;
  }

  function getLentAmount(address vault) external view returns (uint256) {
    address configManager = IVault(vault).getConfigManager();
    MarginlyAdapterConfigStorage configStorage = MarginlyAdapterConfigStorage(configManager);
    uint32 countOfPools = configStorage.getCountOfPools(vault);
    uint32 i;
    uint256 totalLent;
    for (; i < countOfPools; ) {
      MarginlyAdapterConfigStorage.PoolConfig memory config = configStorage.getPoolConfigByIndex(vault, i);
      IMarginlyPool.Position memory position = IMarginlyPool(config.pool).positions(vault);
      if (position._type == IMarginlyPool.PositionType.Lend) {
        totalLent += config.isQuote
          ? position.discountedQuoteAmount.mulDiv(IMarginlyPool(config.pool).quoteCollateralCoeff(), X96_ONE)
          : position.discountedBaseAmount.mulDiv(IMarginlyPool(config.pool).baseCollateralCoeff(), X96_ONE);
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
}
