// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

/// @dev Access to ConfigManager address
abstract contract ConfigManagerStorage is Initializable {
  /// @dev 'ConfigManagerStorage' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.ConfigManagerData")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant ConfigManagerStorageLocation =
    0x9426612723c6e8493485f2a8894855a52655409f92a68b9a5a0b191152b5c800;

  /// @custom:storage-location erc7201:levva-vault.ConfigManagerData
  struct ConfigManagerData {
    address configManager;
  }

  function _getConfigManagerStorage() private pure returns (ConfigManagerData storage $) {
    assembly {
      $.slot := ConfigManagerStorageLocation
    }
  }

  function __ConfigManagerStorage_init(address _configManager) internal onlyInitializing {
    ConfigManagerData storage $ = _getConfigManagerStorage();
    $.configManager = _configManager;
  }

  function _getConfigManager() internal view returns (address) {
    ConfigManagerData storage $ = _getConfigManagerStorage();
    return $.configManager;
  }
}
