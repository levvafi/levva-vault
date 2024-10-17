// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

contract MockAavePoolAddressProvider {
  address public pool;

  constructor(address _pool) {
    pool = _pool;
  }

  function getPool() external view returns (address) {
    return pool;
  }

  function setPool(address _pool) external {
    pool = _pool;
  }
}
