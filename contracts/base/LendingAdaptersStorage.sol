// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {ProtocolType} from '../libraries/ProtocolType.sol';

/// @dev Access to protocol adapters
abstract contract LendingAdaptersStorage {
  /// @dev 'LendingAdaptersData' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.LendingAdaptersData")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant LendingAdaptersDataStorageLocation =
    0x906277d03addfa75e66240578754bb3623b3eda4a2542c16b0f9c4bae97a5900;

  /// @custom:storage-location erc7201:levva-vault.LendingAdaptersData
  struct LendingAdaptersData {
    mapping(ProtocolType protocolType => address) _protocolAdapters;
  }

  /// @dev returns storage slot of 'VaultData' struct
  function _getProtocolStorage() private pure returns (LendingAdaptersData storage $) {
    assembly {
      $.slot := LendingAdaptersDataStorageLocation
    }
  }

  /// @dev Get adapter for protocol by protocol type
  function _getLendingAdapter(ProtocolType protocol) internal view returns (address) {
    return _getProtocolStorage()._protocolAdapters[protocol];
  }

  /// @dev Set adapter for protocol
  function _addLendingAdapter(ProtocolType protocol, address adapterImpl) internal {
    _getProtocolStorage()._protocolAdapters[protocol] = adapterImpl;
  }
}
