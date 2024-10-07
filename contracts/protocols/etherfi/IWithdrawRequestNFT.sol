// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IWithdrawRequestNFT {
  function requestWithdraw(
    uint96 amountOfEEth,
    uint96 shareOfEEth,
    address requester,
    uint256 fee
  ) external payable returns (uint256);

  function claimWithdraw(uint256 requestId) external;

  function isFinalized(uint256 requestId) external view returns (bool);

  function isValid(uint256 requestId) external view returns (bool);

  ///@dev onlyAdmin function
  function finalizeRequests(uint256 requestId) external;

  function requestWithdraw() external;
}
