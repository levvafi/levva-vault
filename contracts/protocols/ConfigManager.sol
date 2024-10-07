// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {UUPSUpgradeable} from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';

import {AaveAdapterConfigStorage} from './aave/AaveAdapterConfigStorage.sol';
import {MarginlyAdapterConfigStorage} from './marginly/MarginlyAdapterConfigStorage.sol';
import {EtherfiAdapterConfigStorage} from './etherfi/EtherfiAdapterConfigStorage.sol';
import {Errors} from '../libraries/Errors.sol';

/// @dev The reason for upgradeability here is to allow for future adapters to be added
/// @dev Keeps adapter specific configurations by vault
contract ConfigManager is
  UUPSUpgradeable,
  Ownable2StepUpgradeable,
  AaveAdapterConfigStorage,
  MarginlyAdapterConfigStorage,
  EtherfiAdapterConfigStorage
{
  /// @dev 'ConfigManagerStorage' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.config.ConfigManagerStorageLocation")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant ConfigManagerStorageLocation =
    0x5c11f0312af6d2dfd5fea9b9bbb27decbb12ea896c8fb7db8a820d255e180400;

  struct ConfigManagerStorage {
    ///@dev registered vaults that can change adapter configurations
    mapping(address vault => bool) _vaults;
  }

  function _getConfigManagerStorage() private pure returns (ConfigManagerStorage storage $) {
    assembly {
      $.slot := ConfigManagerStorageLocation
    }
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function initialize(address weth9, address weeth) external initializer {
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();
    __EtherfiAdapterConfigStorage_init(weth9, weeth);
  }

  function _enforceSenderIsVault() internal view override {
    if (!_getConfigManagerStorage()._vaults[msg.sender]) revert Errors.SenderIsNotVault();
  }

  function addVault(address vault, bool add) external onlyOwner {
    if (vault == address(0)) revert Errors.ZeroAddress();
    _getConfigManagerStorage()._vaults[vault] = add;
  }
}
