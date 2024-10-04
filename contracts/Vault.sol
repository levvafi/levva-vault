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
import {WithdrawRequestQueue} from './base/WithdrawRequestQueue.sol';

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
  ERC721Holder,
  WithdrawRequestQueue
{
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function _getLendingAdapterSafe(ProtocolType protocolType) private view returns (address) {
    address adapterImpl = _getLendingAdapter(protocolType);
    if (adapterImpl == address(0)) revert Errors.AdapterIsNotSet();

    return adapterImpl;
  }

  /// @notice Updates the total amount of assets lent out by the vault
  /// @dev This function iterates through all lending adapters and sums up their lent amounts
  /// @dev The total lent amount is then cached along with the current timestamp
  /// @return The total lent amount
  function _getTotalLent() internal view override returns (uint256) {
    uint256 totalLent;
    uint256 length = uint256(ProtocolType.ProtocolTypeLength);
    uint256 i;
    for (; i < length; ) {
      address adapterImpl = _getLendingAdapter(ProtocolType(i));
      if (adapterImpl != address(0)) {
        totalLent += ILendingAdapter(adapterImpl).getLentAmount(address(this));
      }

      unchecked {
        ++i;
      }
    }

    return totalLent;
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
    return _getLendingAdapter(protocolType);
  }

  /// @notice Retrieves the address of the config manager
  /// @dev This function allows external contracts to query the config manager address
  /// @return The address of the config manager
  function getConfigManager() external view returns (address) {
    return _getConfigManager();
  }

  /// @notice Retrieves the minimum deposit amount required for deposits and minting
  /// @dev This function allows external contracts to query the minimum deposit amount
  /// @return The minimum deposit amount
  function getMinDeposit() external view returns (uint256) {
    return _getMinDeposit();
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

  /// @notice Sets the minimum deposit amount required for deposits and minting
  /// @dev This function can only be called by the contract owner
  /// @param minDeposit The new minimum deposit amount
  function setMinDeposit(uint256 minDeposit) external onlyOwner {
    _setMinDeposit(minDeposit);
    emit MinDepositSet(minDeposit);
  }

  /// @notice Requests for withdraw underlying amount corresponding to shares. Locks shares on address(this)
  /// @dev This function allows users to request a withdrawal of LP tokens
  /// @param shares The amount of LP tokens to withdraw
  function requestWithdraw(uint256 shares) external returns (uint128 requestId) {
    uint256 assets = previewRedeem(shares);
    if (assets <= _getFreeAmount()) {
      revert Errors.NoNeedToRequestWithdraw();
    }

    _transfer(msg.sender, address(this), shares);
    requestId = _enqueueWithdraw(msg.sender, shares);

    emit WithdrawRequested(requestId, msg.sender, shares);
    return requestId;
  }

  /// @notice Finalizes a withdrawal request
  /// @dev This function can only be called by a vault manager. It processes the first withdrawal request in the queue,
  /// redeems the LP tokens, and updates the state accordingly.
  function finalizeWithdrawRequest() external returns (uint256 assets) {
    _enforceSenderIsVaultManager();

    WithdrawRequest memory request = _getWithdrawRequest(0); // first in queue
    uint128 requestId = _getWithdrawQueueStartIndex();
    // all shares from withdraw request must be stored on the address(this)
    // call redeem from sender = address(this) and
    // use this.redeem() not redeem() to change msg.sender from vaultManager to address(this)
    assets = this.redeem(request.shares, request.owner, address(this));
    _dequeueWithdraw();

    emit WithdrawFinalized(requestId, request.owner, request.shares, assets);
    return assets;
  }

  /// @notice Retrieves a specific withdraw request by its ID
  /// @dev This function allows external callers to view the details of a withdraw request
  /// @param requestId The unique identifier of the withdraw request to retrieve
  /// @return The WithdrawRequest struct containing the owner's address and the amount of shares to be withdrawn
  function getWithdrawRequest(uint128 requestId) external view returns (WithdrawRequest memory) {
    uint128 index = requestId - _getWithdrawQueueStartIndex();
    return _getWithdrawRequest(index);
  }

  /// @notice Retrieves the end index of the withdraw queue
  /// @dev This function returns the current end index of the withdraw queue, indicating the position where the next withdraw request will be added.
  /// @return The end index of the withdraw queue as a uint128
  function getWithdrawQueueEndIndex() external view returns (uint128) {
    return _getWithdrawQueueEndIndex();
  }

  /// @notice Retrieves the start index of the withdraw queue
  /// @dev This function returns the current end index of the withdraw queue, indicating the position where the next withdraw request will be added.
  /// @return The end index of the withdraw queue as a uint128
  function getWithdrawQueueStartIndex() external view returns (uint128) {
    return _getWithdrawQueueStartIndex();
  }

  /// @dev Some protocols could send ETH to the vault
  receive() external payable {}
}
