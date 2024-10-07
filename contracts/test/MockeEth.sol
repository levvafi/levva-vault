// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Ownable2Step} from '@openzeppelin/contracts/access/Ownable2Step.sol';
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import {ILiquidityPool} from '../protocols/etherfi/ILiquidityPool.sol';

contract MockeETH is ERC20 {
  uint8 private _decimals;
  ILiquidityPool private _liquidityPool;

  uint256 public totalShares;
  mapping(address => uint256) public shares;

  constructor() ERC20('Mock eETH', 'eETH') {
    _decimals = 18;
  }

  function setTotalShares(uint256 amount) public {
    totalShares = amount;
  }

  function setShares(address user, uint256 amount) public {
    shares[user] = amount;
  }

  function mint(address to, uint256 amount) public {
    shares[to] += amount;
    totalShares += amount;
    _mint(to, amount);
  }

  function burn(address to, uint256 amount) public {
    _burn(to, amount);
  }

  function decimals() public view override(ERC20) returns (uint8) {
    return _decimals;
  }

  function transferETH(address to) public {
    (bool success, ) = to.call{value: address(this).balance}('');
    require(success, 'send value failed');
  }

  function setLiquidityPool(address pool) public {
    _liquidityPool = ILiquidityPool(pool);
  }

  receive() external payable {}
}
