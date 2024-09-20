// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/// @title ILendingAdapter
/// @notice Interface for lending adapters used in the Vault
interface ILendingAdapter {
  /// @notice Update and return the total amount of assets lent through this adapter
  /// @return lentAmount The updated total amount of assets lent
  function updateLentAmount() external returns (uint256 lentAmount);

  /// @notice Get the total amount of assets lent through this adapter
  function getLentAmount(address vault) external view returns (uint256);
}
