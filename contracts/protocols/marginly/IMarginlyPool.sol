// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './FP96.sol';

/// @notice Interface for Marginly v1.5 pools from https://github.com/eq-lab/marginly
interface IMarginlyPool {
  enum CallType {
    DepositBase,
    DepositQuote,
    WithdrawBase,
    WithdrawQuote,
    Short,
    Long,
    ClosePosition,
    Reinit,
    ReceivePosition,
    EmergencyWithdraw
  }

  enum PositionType {
    Uninitialized,
    Lend,
    Short,
    Long
  }

  struct Position {
    /// @dev Type of a given position
    PositionType _type;
    /// @dev Position in heap equals indexOfHeap + 1. Zero value means position does not exist in heap
    uint32 heapPosition;
    /// @dev negative value if _type == Short, positive value otherwise in base asset (e.g. WETH)
    uint256 discountedBaseAmount;
    /// @dev negative value if _type == Long, positive value otherwise in quote asset (e.g. USDC)
    uint256 discountedQuoteAmount;
  }

  struct MarginlyParams {
    /// @dev Maximum allowable leverage in the Regular mode.
    uint8 maxLeverage;
    /// @dev Interest rate. Example 1% = 10000
    uint24 interestRate;
    /// @dev Close debt fee. 1% = 10000
    uint24 fee;
    /// @dev Pool fee. When users take leverage they pay `swapFee` on the notional borrow amount. 1% = 10000
    uint24 swapFee;
    /// @dev Max slippage when margin call
    uint24 mcSlippage;
    /// @dev Min amount of base token to open short/long position
    uint184 positionMinAmount;
    /// @dev Max amount of quote token in system
    uint184 quoteLimit;
  }

  struct Leverage {
    /// @dev This is a leverage of all long positions in the system
    uint128 shortX96;
    /// @dev This is a leverage of all short positions in the system
    uint128 longX96;
  }

  function systemLeverage() external view returns (Leverage memory);

  function quoteToken() external view returns (address);

  function baseToken() external view returns (address);

  function discountedQuoteCollateral() external view returns (uint256);

  function discountedQuoteDebt() external view returns (uint256);

  function discountedBaseCollateral() external view returns (uint256);

  function discountedBaseDebt() external view returns (uint256);

  function baseDelevCoeff() external view returns (FP96.FixedPoint memory);

  function quoteDelevCoeff() external view returns (FP96.FixedPoint memory);

  function quoteCollateralCoeff() external view returns (FP96.FixedPoint memory);

  function baseCollateralCoeff() external view returns (FP96.FixedPoint memory);

  function baseDebtCoeff() external view returns (FP96.FixedPoint memory);

  function quoteDebtCoeff() external view returns (FP96.FixedPoint memory);

  function positions(address positionAddress) external view returns (Position memory);

  function lastReinitTimestampSeconds() external view returns (uint256);

  function params() external view returns (MarginlyParams memory);

  function execute(
    CallType call,
    uint256 amount1,
    int256 amount2,
    uint256 limitPriceX96,
    bool flag,
    address receivePositionAddress,
    uint256 swapCalldata
  ) external payable;

  struct FixedPoint {
    uint256 inner;
  }

  function getBasePrice() external view returns (FixedPoint memory);

  function defaultSwapCallData() external view returns (uint32);
}
