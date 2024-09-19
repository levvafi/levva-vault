// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {LendingAdaptersStorage} from '../base/LendingAdaptersStorage.sol';
import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {ProtocolType} from '../libraries/ProtocolType.sol';

interface IVault is IERC4626 {
  event Seed(ProtocolType protocol, uint256 supplied, bytes data);

  event Harvest(ProtocolType protocol, uint256 withdrawn, bytes data);

  event UpdateTotalLent(uint256 totalLent, uint256 timestamp, uint256 oldTotalLent, uint256 oldTimestamp);

  event AddLendingAdapter(ProtocolType protocolType, address adapter);

  function getFreeAmount() external view returns (uint256);

  function getTotalLent() external view returns (uint256);

  function getLendingAdapter(ProtocolType protocolType) external view returns (address);

  function getConfigManager() external view returns (address);

  function getLentAmount(ProtocolType protocol) external view returns (uint256);

  function updateTotalLent() external;

  function seed(ProtocolType protocol, bytes calldata data) external returns (uint256);

  function harvest(ProtocolType protocol, bytes calldata data) external returns (uint256);

  function addVaultManager(address manager, bool add) external;

  function addLendingAdapter(ProtocolType protocolType, address adapter) external;
}
