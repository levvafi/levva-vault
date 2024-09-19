// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/// @title ILendingAdapter
/// @notice Interface for lending adapters used in the Vault
interface ILendingAdapter {
  /// @notice Supply assets to the lending protocol
  /// @param data Additional data required by the specific lending protocol
  function supply(bytes calldata data) external returns (uint256 supplyAmount);

  /// @notice Withdraw assets from the lending protocol
  /// @param data Additional data required by the specific lending protocol
  function withdraw(bytes calldata data) external returns (uint256 withdrawnAmount);

  /// @notice Update and return the total amount of assets lent through this adapter
  /// @return lentAmount The updated total amount of assets lent
  function updateLentAmount() external returns (uint256 lentAmount);

  /// @notice Get the total amount of assets lent through this adapter
  function getLentAmount(address vault) external view returns (uint256);
}
