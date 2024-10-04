// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IMarginlyPool} from '../protocols/marginly/IMarginlyPool.sol';
import {FP96} from '../protocols/marginly/FP96.sol';

/// @notice The official IAToken Aave interface duplicates the IERC20 interface, so we use this simple version.
/// https://github.com/eq-lab/marginly
contract MockMarginlyPool is IMarginlyPool {
  using SafeERC20 for IERC20;

  address public override quoteToken;

  address public override baseToken;

  uint256 public override discountedQuoteCollateral;

  uint256 public override discountedQuoteDebt;

  uint256 public override discountedBaseCollateral;

  uint256 public override discountedBaseDebt;

  uint256 public _somState;

  uint256[] public _somArray;

  mapping(address => Position) public _positions;

  constructor(address _baseToken, address _quoteToken) {
    baseToken = _baseToken;
    quoteToken = _quoteToken;
  }

  function setPosition(address positionAddress, Position memory position) public {
    _positions[positionAddress] = position;
    discountedQuoteCollateral += position.discountedQuoteAmount;
    discountedBaseCollateral += position.discountedBaseAmount;
  }

  function execute(CallType call, uint256 amount1, int256, uint256, bool, address, uint256) external payable override {
    Position memory position = _positions[msg.sender];

    if (call == CallType.DepositBase) {
      IERC20(baseToken).transferFrom(msg.sender, address(this), amount1);
      position._type = PositionType.Lend;
      position.discountedBaseAmount += amount1;
      discountedBaseCollateral += amount1;
    } else if (call == CallType.DepositQuote) {
      IERC20(quoteToken).transferFrom(msg.sender, address(this), amount1);
      position._type = PositionType.Lend;
      position.discountedQuoteAmount += amount1;
      discountedQuoteCollateral += amount1;
    } else if (call == CallType.WithdrawBase) {
      IERC20(baseToken).transfer(msg.sender, amount1);
      position.discountedBaseAmount -= amount1;
      if (position.discountedBaseAmount == 0) {
        position._type = PositionType.Uninitialized;
      }
      discountedBaseCollateral -= amount1;
    } else if (call == CallType.WithdrawQuote) {
      IERC20(quoteToken).transfer(msg.sender, amount1);
      position.discountedQuoteAmount -= amount1;
      if (position.discountedQuoteAmount == 0) {
        position._type = PositionType.Uninitialized;
      }
      discountedQuoteCollateral -= amount1;
    } else if (call == CallType.Reinit) {
      //simulate some computations that takes a lot of gas
      // reinit takes 272K gas without MC
      // 300K - 500K gas with MC
      for (uint256 i = 0; i < 7; i++) {
        _somArray.push(i);
      }
    }

    _positions[msg.sender] = position;
  }

  function positions(address positionAddress) external view override returns (Position memory) {
    return _positions[positionAddress];
  }

  function getBasePrice() external pure returns (FixedPoint memory fp) {
    fp.inner = 2 ** 96;
  }

  function defaultSwapCallData() external pure returns (uint32) {
    return 0;
  }

  function baseDelevCoeff() external view override returns (FP96.FixedPoint memory) {}

  function quoteDelevCoeff() external view override returns (FP96.FixedPoint memory) {}

  function lastReinitTimestampSeconds() external view override returns (uint256) {}

  function params() external pure override returns (MarginlyParams memory) {
    return
      MarginlyParams({
        maxLeverage: 20,
        interestRate: 10000,
        fee: 0,
        swapFee: 0,
        mcSlippage: 0,
        positionMinAmount: 0,
        quoteLimit: 10000000000
      });
  }

  function quoteCollateralCoeff() external pure override returns (FP96.FixedPoint memory) {
    return FP96.one();
  }

  function baseCollateralCoeff() external pure override returns (FP96.FixedPoint memory) {
    return FP96.one();
  }

  function systemLeverage() external pure override returns (Leverage memory) {
    return Leverage({shortX96: uint128(FP96.one().inner), longX96: uint128(FP96.one().inner)});
  }

  function baseDebtCoeff() external view override returns (FP96.FixedPoint memory) {
    return FP96.one();
  }

  function quoteDebtCoeff() external view override returns (FP96.FixedPoint memory) {
    return FP96.one();
  }
}
