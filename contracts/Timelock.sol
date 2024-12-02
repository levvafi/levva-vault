// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {TimelockController} from '@openzeppelin/contracts/governance/TimelockController.sol';

contract Timelock is TimelockController {
  constructor(
    uint256 minDelay,
    address[] memory proposers,
    address[] memory executors,
    address admin
  ) TimelockController(minDelay, proposers, executors, admin) {}
}