// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface ILiquidityPool {
  function withdrawRequestNFT() external returns (address);
  function eETH() external view returns (address);
  function deposit() external payable returns (uint256);
  function withdraw(address _recipient, uint256 _amount) external returns (uint256);
  function requestWithdraw(address recipient, uint256 amount) external returns (uint256);

  /// @notice Calculates the amount of weETH for a given amount of eETH
  function sharesForAmount(uint256 _amount) external view returns (uint256);

  /// @notice Get the total amount of ether that can be claimed by the user
  function getTotalEtherClaimOf(address _user) external view returns (uint256);

  function rebase(int128 _accruedRewards) external;

  function getTotalPooledEther() external view returns (uint256);
}
