// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {LendingAdaptersStorage} from '../base/LendingAdaptersStorage.sol';
import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {ProtocolType} from '../libraries/ProtocolType.sol';
import {WithdrawRequestQueue} from '../base/WithdrawRequestQueue.sol';

interface IVault is IERC4626 {
  event ProtocolActionExecuted(ProtocolType indexed protocol, bytes data, bytes result);

  event AddLendingAdapter(ProtocolType indexed protocolType, address indexed adapter);

  event AddVaultManager(address indexed manager, bool add);

  event MinDepositSet(uint256 minDeposit);

  event WithdrawRequested(uint128 indexed requestId, address indexed owner, uint256 shares);

  event WithdrawFinalized(uint128 indexed requestId, address indexed owner, uint256 shares, uint256 assets);

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

  function getMinDeposit() external view returns (uint256);

  function executeProtocolAction(ProtocolActionArg[] calldata protocolActionArgs) external returns (bytes[] memory);

  function addVaultManager(address manager, bool add) external;

  function addLendingAdapter(ProtocolType protocolType, address adapter) external;

  function setMinDeposit(uint256 minDeposit) external;

  function requestWithdraw(uint256 shares) external;

  function finalizeWithdrawRequest() external returns (uint256 assets);

  function getWithdrawRequest(uint128 requestId) external view returns (WithdrawRequestQueue.WithdrawRequest memory);

  function getWithdrawQueueEndIndex() external view returns (uint128);

  function getWithdrawQueueStartIndex() external view returns (uint128);
}
