// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

/// @title ILendingAdapter
/// @notice Interface for lending adapters used in the Vault
interface ILendingAdapter {
  /// @notice Get the total amount of assets lent through this adapter
  function getLentAmount(address vault) external view returns (uint256);
}
