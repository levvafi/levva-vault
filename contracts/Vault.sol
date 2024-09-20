// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {UUPSUpgradeable} from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';

import {AbstractVault} from './base/AbstractVault.sol';
import {LendingAdaptersStorage} from './base/LendingAdaptersStorage.sol';
import {ConfigManagerStorage} from './base/ConfigManagerStorage.sol';
import {AccessControl} from './base/AccessControl.sol';
import {ILendingAdapter} from './interfaces/ILendingAdapter.sol';
import {ProtocolType} from './libraries/ProtocolType.sol';
import {Errors} from './libraries/Errors.sol';
import {IVault} from './interfaces/IVault.sol';
import {ERC721Holder} from '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

/// @title Vault
/// @notice A upgradeable ERC4626 vault with lending adapter and config manager functionality
/// @dev This contract inherits from UUPSUpgradeable, Ownable2StepUpgradeable, ERC4626Vault, LendingAdaptersStorage, and ConfigManagerStorage
contract Vault is
  IVault,
  UUPSUpgradeable,
  Ownable2StepUpgradeable,
  AbstractVault,
  AccessControl,
  LendingAdaptersStorage,
  ConfigManagerStorage,
  // ERC721Holder is used to allow the vault to receive Etherfi's WithdrawRequestNFT
  ERC721Holder
{
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function _getLendingAdapterSafe(ProtocolType protocolType) private view returns (address) {
    address adapterImpl = _getLendginAdapter(protocolType);
    if (adapterImpl == address(0)) revert Errors.AdapterIsNotSet();

    return adapterImpl;
  }

  /// @notice Updates the total amount of assets lent out by the vault
  /// @dev This function iterates through all lending adapters and sums up their lent amounts
  /// @dev The total lent amount is then cached along with the current timestamp
  function _updateTotalLent() internal override {
    uint256 oldTotalLent = _getTotalLent();
    uint256 oldTimestamp = _getTotalLentUpdatedAt();

    uint256 totalLent;
    uint256 length = uint256(ProtocolType.ProtocolTypeLength);
    uint256 i;
    for (; i < length; ) {
      address adapterImpl = _getLendginAdapter(ProtocolType(i));
      if (adapterImpl != address(0)) {
        bytes memory returnedData = Address.functionDelegateCall(
          adapterImpl,
          abi.encodeWithSelector(ILendingAdapter.updateLentAmount.selector)
        );
        totalLent += abi.decode(returnedData, (uint256));
      }

      unchecked {
        ++i;
      }
    }

    _setTotalLent(totalLent, block.timestamp);

    emit UpdateTotalLent(totalLent, block.timestamp, oldTotalLent, oldTimestamp);
  }

  function initialize(
    address _asset,
    string memory lpName,
    string memory lpSymbol,
    address configManager
  ) external initializer {
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();
    __AbstractVault_init(_asset, lpName, lpSymbol);
    __ConfigManagerStorage_init(configManager);
  }

  /// @notice Returns the amount of free (unused) assets in the vault
  /// @return The amount of free assets
  function getFreeAmount() external view returns (uint256) {
    return _getFreeAmount();
  }

  /// @notice Returns the total amount of assets lent out by the vault
  /// @return The total amount of lent assets
  function getTotalLent() external view returns (uint256) {
    return _getTotalLent();
  }

  /// @notice Updates the total amount lent across all lending protocols
  /// @dev This function calls the internal _updateTotalLent() function to recalculate and update the cached total lent value
  /// @dev Can be called by any external address to refresh the total lent amount
  function updateTotalLent() external {
    _updateTotalLent();
  }

  /// @notice Executes a protocol action for a given protocol type
  /// @dev This function iterates through the provided protocol action arguments, calls the corresponding lending adapter,
  /// @dev and emits an event with the protocol type, arguments, and returned data
  /// @param actionArgs An array of ProtocolActionArg structs containing the protocol type and arguments
  /// @return returnData An array of bytes containing the returned data from each protocol action
  function executeProtocolAction(ProtocolActionArg[] calldata actionArgs) external returns (bytes[] memory returnData) {
    _enforceSenderIsVaultManager();

    uint256 length = actionArgs.length;
    uint256 i;
    returnData = new bytes[](length);
    for (; i < length; ) {
      ProtocolActionArg memory actionArg = actionArgs[i];

      address adapterImpl = _getLendingAdapterSafe(actionArg.protocol);
      bytes memory result = Address.functionDelegateCall(adapterImpl, actionArg.data);
      returnData[i] = result;

      emit ProtocolActionExecuted(actionArg.protocol, actionArg.data, result);

      unchecked {
        ++i;
      }
    }
  }

  /// @notice Retrieves the amount of assets lent to a specific protocol
  /// @dev This function calls the corresponding lending adapter to get the lent amount
  /// @param protocol The type of lending protocol to query
  /// @return The amount of assets lent to the specified protocol
  function getLentAmount(ProtocolType protocol) external view returns (uint256) {
    address adapterImpl = _getLendingAdapterSafe(protocol);
    return ILendingAdapter(adapterImpl).getLentAmount(address(this));
  }

  /// @notice Retrieves the address of the lending adapter for a specific protocol
  /// @dev This function allows external contracts to query the adapter address for a given protocol type
  /// @param protocolType The type of lending protocol to get the adapter for
  /// @return The address of the lending adapter for the specified protocol type
  function getLendingAdapter(ProtocolType protocolType) external view returns (address) {
    return _getLendginAdapter(protocolType);
  }

  /// @notice Retrieves the address of the config manager
  /// @dev This function allows external contracts to query the config manager address
  /// @return The address of the config manager
  function getConfigManager() external view returns (address) {
    return _getConfigManager();
  }

  /// @notice Adds or removes a vault manager
  /// @dev This function can only be called by the contract owner
  /// @param manager The address of the manager to add or remove
  /// @param add True to add the manager, false to remove
  function addVaultManager(address manager, bool add) external onlyOwner {
    _addVaultManager(manager, add);
  }

  /// @notice Adds a new lending adapter for a specific protocol type
  /// @dev This function can only be called by the contract owner
  /// @param protocolType The type of lending protocol for which to add the adapter
  /// @param adapter The address of the lending adapter to be added
  function addLendingAdapter(ProtocolType protocolType, address adapter) external onlyOwner {
    _addLendingAdapter(protocolType, adapter);
    emit AddLendingAdapter(protocolType, adapter);
  }

  /// @dev Some protocols could send ETH to the vault
  receive() external payable {}
}
