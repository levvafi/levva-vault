// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {Errors} from '../../libraries/Errors.sol';
import {IWeETH} from './IWeETH.sol';
import {VaultAccessible} from '../VaultAccessible.sol';

abstract contract EtherfiAdapterConfigStorage is Initializable, Ownable2StepUpgradeable, VaultAccessible {
  /// @dev 'EtherfiAdapterConfig' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.config.EtherfiAdapterConfig")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant EtherfiAdapterConfigsLocation =
    0x20efba382d2cdbc4efe3592e1b7772fee0ae05b7d83b82da7cfb7c8be56e1700;

  struct QueueItem {
    /// @dev requestId of the unstake request
    uint256 requestId;
    /// @dev amount of ETH to withdraw
    uint256 amount;
  }

  struct EtherfiUnstakeQueue {
    /// @dev queue inner starting index. Increased after popping the first element
    uint128 start;
    /// @dev queue inner ending index. Increased after pushing the new element
    uint128 end;
    /// @dev queue items
    mapping(uint128 index => QueueItem item) items;
  }

  /// @custom:storage-location erc7201:levva-vault.config.EtherfiAdapterConfig
  struct EtherfiAdapterConfig {
    address _weth9;
    address _weeth;
    address _weethEthPriceOracle;
    mapping(address vault => EtherfiUnstakeQueue queue) _unstakeQueue;
    ///@dev pending withdrawals from etherfi
    mapping(address vault => uint256) _pendingWithdrawals;
  }

  function _getEtherfiAdapterConfigsStorage() private pure returns (EtherfiAdapterConfig storage $) {
    assembly {
      $.slot := EtherfiAdapterConfigsLocation
    }
  }

  function __EtherfiAdapterConfigStorage_init(address _weth9, address _weeth) internal onlyInitializing {
    EtherfiAdapterConfig storage $ = _getEtherfiAdapterConfigsStorage();
    $._weth9 = _weth9;
    $._weeth = _weeth;
  }

  function _addPendingWithdrawals(uint256 amount) private {
    _getEtherfiAdapterConfigsStorage()._pendingWithdrawals[msg.sender] += amount;
  }

  function _subPendingWithdrawals(uint256 amount) private {
    _getEtherfiAdapterConfigsStorage()._pendingWithdrawals[msg.sender] -= amount;
  }

  function enqueueUnstakeRequest(uint256 requestId, uint256 withdrawAmount) external {
    _enforceSenderIsVault();

    EtherfiAdapterConfig storage $ = _getEtherfiAdapterConfigsStorage();
    uint128 queueEnd = $._unstakeQueue[msg.sender].end;
    $._unstakeQueue[msg.sender].items[queueEnd] = QueueItem({requestId: requestId, amount: withdrawAmount});
    _addPendingWithdrawals(withdrawAmount);

    unchecked {
      $._unstakeQueue[msg.sender].end = queueEnd + 1;
    }
  }

  function dequeueUnstakeRequest() external returns (uint256) {
    _enforceSenderIsVault();

    EtherfiAdapterConfig storage $ = _getEtherfiAdapterConfigsStorage();
    uint128 queueStart = $._unstakeQueue[msg.sender].start;
    QueueItem memory item = $._unstakeQueue[msg.sender].items[queueStart];
    uint256 requestId = item.requestId;
    _subPendingWithdrawals(item.amount);

    unchecked {
      $._unstakeQueue[msg.sender].start = queueStart + 1;
    }

    return requestId;
  }

  function peekUnstakeRequestId(address vault) external view returns (uint256) {
    EtherfiAdapterConfig storage $ = _getEtherfiAdapterConfigsStorage();
    uint128 queueStart = $._unstakeQueue[vault].start;
    return $._unstakeQueue[vault].items[queueStart].requestId;
  }

  function getWeth9() external view returns (address) {
    return _getEtherfiAdapterConfigsStorage()._weth9;
  }

  function getWeETH() external view returns (address) {
    return _getEtherfiAdapterConfigsStorage()._weeth;
  }

  function getPendingWithdrawals(address vault) external view returns (uint256) {
    return _getEtherfiAdapterConfigsStorage()._pendingWithdrawals[vault];
  }
}
