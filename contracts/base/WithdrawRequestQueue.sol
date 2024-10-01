// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {Errors} from '../libraries/Errors.sol';

abstract contract WithdrawRequestQueue {
  /// @dev 'WithdrawQueueStorageData' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.WithdrawQueueStorage")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant WithdrawQueueStorageLocation =
    0x7c1e4efde9cf9c61775fc1cd8db857542ca2e49e1dab178548686989fd577300;

  struct WithdrawRequest {
    /// @dev address of user
    address owner;
    /// @dev lp amount to burn and exchange for underlying token
    uint256 shares;
  }

  struct WithdrawQueueStorage {
    /// @dev queue inner starting index. Increased after dequeue
    uint128 start;
    /// @dev queue inner ending index. Increased after enqueue
    uint128 end;
    /// @dev queue items
    mapping(uint128 index => WithdrawRequest item) items;
  }

  function _getWithdrawQueueStorageData() private pure returns (WithdrawQueueStorage storage $) {
    assembly {
      $.slot := WithdrawQueueStorageLocation
    }
  }

  function _enqueueWithdraw(address owner, uint256 shares) internal returns (uint128 requestId) {
    WithdrawQueueStorage storage queue = _getWithdrawQueueStorageData();
    requestId = queue.end;
    queue.items[requestId] = WithdrawRequest({owner: owner, shares: shares});
    unchecked {
      ++queue.end;
    }
  }

  function _dequeueWithdraw() internal returns (WithdrawRequest memory queueItem) {
    WithdrawQueueStorage storage queue = _getWithdrawQueueStorageData();
    uint128 queueStart = queue.start;
    queueItem = queue.items[queueStart];
    delete queue.items[queueStart];
    unchecked {
      ++queue.start;
    }
  }

  function _getWithdrawRequest(uint128 index) internal view returns (WithdrawRequest memory queueItem) {
    WithdrawQueueStorage storage queue = _getWithdrawQueueStorageData();
    uint128 memoryIndex = queue.start + index;
    if (memoryIndex >= queue.end) revert Errors.NoElementWithIndex(index);

    return queue.items[memoryIndex];
  }

  function _getWithdrawQueueStartIndex() internal view returns (uint128) {
    return _getWithdrawQueueStorageData().start;
  }

  function _getWithdrawQueueEndIndex() internal view returns (uint128) {
    return _getWithdrawQueueStorageData().end;
  }
}
