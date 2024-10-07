// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {MockeETH} from './MockeEth.sol';
import {IWithdrawRequestNFT} from '../protocols/etherfi/IWithdrawRequestNFT.sol';

contract MockEtherfiLiquidityPool {
  address public eETH;
  address public withdrawRequestNFT;

  constructor(address _eETH, address _withdrawRequestNFT) {
    eETH = _eETH;
    withdrawRequestNFT = _withdrawRequestNFT;
  }

  function deposit() external payable returns (uint256) {
    require(msg.value > 0, 'msg value is 0');

    MockeETH(payable(eETH)).mint(msg.sender, msg.value);
    return msg.value;
  }

  function rebase(address to) public payable returns (uint256) {
    require(msg.value > 0, 'msg value is 0');

    MockeETH(payable(eETH)).mint(to, msg.value);
    return msg.value;
  }

  function requestWithdraw(address recipient, uint256 amount) external returns (uint256) {
    IERC20(payable(eETH)).transferFrom(msg.sender, address(withdrawRequestNFT), amount);

    uint256 requestId = IWithdrawRequestNFT(withdrawRequestNFT).requestWithdraw(
      uint96(amount),
      uint96(amount),
      recipient,
      0
    );
    return requestId;
  }

  function withdraw(address _recipient, uint256 _amount) external returns (uint256) {
    require(msg.sender == address(withdrawRequestNFT), 'Incorrect Caller');

    MockeETH(payable(eETH)).burn(msg.sender, _amount);

    _sendFund(_recipient, _amount);

    return _amount;
  }

  function transferETH(address to) public {
    (bool success, ) = to.call{value: address(this).balance}('');
    require(success, 'send value failed');
  }

  function setEETH(address _eETH, address _withdrawRequestNFT) public {
    eETH = _eETH;
    withdrawRequestNFT = _withdrawRequestNFT;
  }

  function _sendFund(address _recipient, uint256 _amount) internal {
    uint256 balanace = address(this).balance;
    (bool sent, ) = _recipient.call{value: _amount}('');
    require(sent && address(this).balance == balanace - _amount, 'SendFail');
  }

  function getTotalEtherClaimOf(address _user) external view returns (uint256) {
    uint256 staked;
    uint256 totalShares = MockeETH(payable(eETH)).totalShares();
    if (totalShares > 0) {
      staked = (getTotalPooledEther() * MockeETH(payable(eETH)).shares(_user)) / totalShares;
    }
    return staked;
  }

  function getTotalPooledEther() public view returns (uint256) {
    return address(this).balance;
  }

  receive() external payable {}
}
