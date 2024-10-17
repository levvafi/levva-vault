// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {Errors} from '../../libraries/Errors.sol';

abstract contract AaveAdapterConfigStorage is Ownable2StepUpgradeable {
  /// @dev 'AaveAdapterConfig' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.config.AaveAdapterConfig")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant AaveAdapterConfigsLocation =
    0x93983dcb6eaac300cd6814ef579e4c605c1c7e706546523f7e298bcb78ab2100;

  /// @custom:storage-location erc7201:levva-vault.config.AaveAdapterConfig
  struct AaveAdapterConfig {
    address poolAddressProvider;
  }

  function _getAaveAdapterConfigsStorage() private pure returns (AaveAdapterConfig storage $) {
    assembly {
      $.slot := AaveAdapterConfigsLocation
    }
  }

  function getAavePoolAddressProvider() external view returns (address) {
    return _getAaveAdapterConfigsStorage().poolAddressProvider;
  }

  function setAavePoolAddressProvider(address poolAddressProvider) external onlyOwner {
    if (poolAddressProvider == address(0)) revert Errors.ZeroAddress();

    _getAaveAdapterConfigsStorage().poolAddressProvider = poolAddressProvider;
  }
}
