// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

interface IWeETH {
  /// @notice Returns the address of the liquidity pool
  function liquidityPool() external view returns (address);

  /// @notice Returns the address of the eETH token
  function eETH() external view returns (address);

  /// @notice Wraps eEth
  /// @param _eETHAmount the amount of eEth to wrap
  /// @return returns the amount of weEth the user receives
  function wrap(uint256 _eETHAmount) external returns (uint256);
}
