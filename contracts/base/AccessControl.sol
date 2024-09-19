// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../libraries/Errors.sol';

abstract contract AccessControl {
  /// @dev 'AccessControlStorage' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.AccessControlStorage")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant AccessControlStorageLocation =
    0xbcf54c63505e04cb16bdfe474df85f1ddd776d99a7fa80c7bf025070e99e0a00;

  struct AccessControlStorage {
    /// @dev  vault managers
    mapping(address => bool) _vaultManagers;
  }

  /// @dev returns storage slot of 'AccessControlStorage' struct
  function _getAccessControlStorage() private pure returns (AccessControlStorage storage $) {
    assembly {
      $.slot := AccessControlStorageLocation
    }
  }

  function _addVaultManager(address user, bool add) internal {
    _getAccessControlStorage()._vaultManagers[user] = add;
  }

  function _enforceSenderIsVaultManager() internal view {
    if (!_getAccessControlStorage()._vaultManagers[msg.sender]) revert Errors.SenderIsNotVaultManager();
  }
}
