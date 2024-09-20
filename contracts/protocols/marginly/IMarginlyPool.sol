// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

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

  function quoteToken() external view returns (address);

  function baseToken() external view returns (address);

  function quoteCollateralCoeff() external view returns (uint256);

  function baseCollateralCoeff() external view returns (uint256);

  function positions(address positionAddress) external view returns (Position memory);

  function execute(
    CallType call,
    uint256 amount1,
    int256 amount2,
    uint256 limitPriceX96,
    bool flag,
    address receivePositionAddress,
    uint256 swapCalldata
  ) external payable;
}
