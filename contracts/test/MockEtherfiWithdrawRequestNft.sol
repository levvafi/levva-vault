// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {ERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import {ILiquidityPool} from '../protocols/etherfi/ILiquidityPool.sol';

contract MockEtherfiWithdrawRequestNFT is ERC721Enumerable {
  struct WithdrawRequest {
    uint96 amountOfEEth;
    uint96 shareOfEEth;
    bool isValid;
    uint32 feeGwei;
  }

  ILiquidityPool private _liquidityPool;

  uint256 private _nextRequestId;
  mapping(uint256 => WithdrawRequest) private _withdrawRequests;
  mapping(uint256 => bool) private _isFinalizeds;
  mapping(uint256 => bool) private _isClaimeds;

  constructor() ERC721('MockEtherfiWithdrawRequestNFT', 'WithdrawRequestNFT') {
    _nextRequestId = 1;
  }

  function requestWithdraw(
    uint96 amountOfEEth,
    uint96 shareOfEEth,
    address requester,
    uint256 fee
  ) external payable returns (uint256) {
    require(msg.sender == address(_liquidityPool), 'Incorrect Caller');

    uint256 reqId = _nextRequestId++;
    _withdrawRequests[reqId].amountOfEEth = amountOfEEth;
    _withdrawRequests[reqId].shareOfEEth = shareOfEEth;
    _withdrawRequests[reqId].isValid = true;
    _withdrawRequests[reqId].feeGwei = uint32(fee / 1 gwei);

    _mint(requester, reqId);

    return reqId;
  }

  function claimWithdraw(uint256 requestId) external {
    address reqOwner = ownerOf(requestId);
    require(reqOwner == msg.sender, 'Not Owner');
    require(!_isClaimeds[requestId], 'Already Claimed');

    _liquidityPool.withdraw(reqOwner, _withdrawRequests[requestId].amountOfEEth);

    _isClaimeds[requestId] = true;

    _burn(requestId);
  }

  function getRequest(uint256 requestId) external view returns (WithdrawRequest memory) {
    return _withdrawRequests[requestId];
  }

  function isFinalized(uint256 requestId) external view returns (bool) {
    return _isFinalizeds[requestId];
  }

  function isValid(uint256 requestId) external view returns (bool) {
    return _withdrawRequests[requestId].isValid;
  }

  function setWithdrawalStatus(uint256 requestId, bool isFinalized_, bool isClaimed_) public {
    _isFinalizeds[requestId] = isFinalized_;
    _isClaimeds[requestId] = isClaimed_;
  }

  function setLiquidityPool(address pool, address /*eETH_*/) public {
    _liquidityPool = ILiquidityPool(pool);
  }
}
