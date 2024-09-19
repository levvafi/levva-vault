// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import {IPool} from '@aave/core-v3/contracts/interfaces/IPool.sol';
import {DataTypes} from '@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol';

import {IAToken} from '../protocols/aave/IAToken.sol';

contract MockAavePool {
  using SafeERC20 for IERC20;

  DataTypes.ReserveData public reserveData;

  constructor() {
    MockAToken aToken = new MockAToken();
    reserveData.aTokenAddress = address(aToken);
  }

  function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
    IERC20(asset).transferFrom(onBehalfOf, address(this), amount);
  }

  function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
    IERC20(asset).transfer(to, amount);
    return amount;
  }

  function getReserveData(address) external view returns (DataTypes.ReserveData memory) {
    return reserveData;
  }

  function getReserveNormalizedIncome(address asset) external view returns (uint256) {
    return IERC20(asset).balanceOf(address(this));
  }
}

// Mock AToken
contract MockAToken {
  function scaledBalanceOf(address) public pure returns (uint256) {
    return 1;
  }
}
