// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {LendingAdaptersStorage} from '../base/LendingAdaptersStorage.sol';
import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {ProtocolType} from '../libraries/ProtocolType.sol';

interface IVault is IERC4626 {
  event ProtocolActionExecuted(ProtocolType protocol, bytes data, bytes result);

  event UpdateTotalLent(uint256 totalLent, uint256 timestamp, uint256 oldTotalLent, uint256 oldTimestamp);

  event AddLendingAdapter(ProtocolType protocolType, address adapter);

  struct ProtocolActionArg {
    /// @dev Protocol type
    ProtocolType protocol;
    /// @dev Calldata to be passed to the lending adapter
    bytes data;
  }

  function getFreeAmount() external view returns (uint256);

  function getTotalLent() external view returns (uint256);

  function getLendingAdapter(ProtocolType protocolType) external view returns (address);

  function getConfigManager() external view returns (address);

  function getLentAmount(ProtocolType protocol) external view returns (uint256);

  function updateTotalLent() external returns (uint256);

  function executeProtocolAction(ProtocolActionArg[] calldata protocolActionArgs) external returns (bytes[] memory);

  function addVaultManager(address manager, bool add) external;

  function addLendingAdapter(ProtocolType protocolType, address adapter) external;
}
