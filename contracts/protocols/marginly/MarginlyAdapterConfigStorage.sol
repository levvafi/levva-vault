// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {Errors} from '../../libraries/Errors.sol';
import {IMarginlyPool} from './IMarginlyPool.sol';

abstract contract MarginlyAdapterConfigStorage is Ownable2StepUpgradeable {
  event MarginlyPoolAdded(address vault, address pool);
  event MarginlyPoolRemoved(address vault, address pool);

  uint8 public constant POOL_LIMITS = 7;

  /// @dev 'MarginlyAdapterConfigs' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.MarginlyAdapterConfig")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant MarginlyAdapterConfigsLocation =
    0xa6eb3fa43364fcf123cd77d373f6f8bf6683b4d7d4efe71af6a9e32cfb504500;

  struct PoolConfig {
    // flag to indicate if pool is initialized
    bool initialized;
    // true if underlyingAsset is quote
    bool isQuote;
  }

  struct MarginlyConfig {
    uint32 _countOfPools;
    mapping(address marginlyPool => PoolConfig) _poolConfigs;
    mapping(uint32 index => address marginlyPool) _poolByIndex;
  }
  /// @custom:storage-location erc7201:levva-vault.MarginlyAdapterConfig
  struct MarginlyAdapterConfig {
    mapping(address vault => MarginlyConfig config) _configs;
  }

  function _getMarginlyAdapterConfigsStorage() private pure returns (MarginlyAdapterConfig storage $) {
    assembly {
      $.slot := MarginlyAdapterConfigsLocation
    }
  }

  function addMarginlyPool(address vault, address pool) external onlyOwner {
    if (pool == address(0)) revert Errors.ZeroAddress();
    MarginlyConfig storage $ = _getMarginlyAdapterConfigsStorage()._configs[vault];

    uint32 countOfPools = $._countOfPools;
    if (countOfPools == POOL_LIMITS) revert Errors.PoolsLimitReached();

    PoolConfig memory config = $._poolConfigs[pool];
    if (config.initialized) revert Errors.PoolAlreadyAdded();

    address asset = IERC4626(vault).asset();

    config.initialized = true;
    if (IMarginlyPool(pool).quoteToken() == asset) {
      config.isQuote = true;
    } else if (IMarginlyPool(pool).baseToken() == asset) {
      config.isQuote = false;
    } else {
      revert Errors.WronMarginlyPool();
    }

    $._poolConfigs[pool] = config;
    $._poolByIndex[countOfPools] = pool;
    $._countOfPools = countOfPools + 1;

    emit MarginlyPoolAdded(vault, pool);
  }

  function removeMarginlyPool(address vault, uint32 poolIndex) external onlyOwner {
    MarginlyConfig storage $ = _getMarginlyAdapterConfigsStorage()._configs[vault];
    address pool = $._poolByIndex[poolIndex];
    if (pool == address(0)) revert Errors.UnknownPool();

    if (IMarginlyPool(pool).positions(vault)._type != IMarginlyPool.PositionType.Uninitialized)
      revert Errors.VaultHasPositionInPool();

    uint32 countOfPools = $._countOfPools;
    uint32 lastIndex = countOfPools - 1;
    if (poolIndex != lastIndex) {
      $._poolByIndex[poolIndex] = $._poolByIndex[lastIndex];
    }

    delete $._poolByIndex[lastIndex];
    delete $._poolConfigs[pool];

    $._countOfPools = lastIndex;
    emit MarginlyPoolRemoved(vault, pool);
  }

  function getCountOfPools(address vault) external view returns (uint32) {
    return _getMarginlyAdapterConfigsStorage()._configs[vault]._countOfPools;
  }

  function getPoolConfig(address vault, address pool) external view returns (PoolConfig memory) {
    return _getMarginlyAdapterConfigsStorage()._configs[vault]._poolConfigs[pool];
  }

  function getPoolByIndex(address vault, uint32 index) external view returns (address) {
    return _getMarginlyAdapterConfigsStorage()._configs[vault]._poolByIndex[index];
  }
}
