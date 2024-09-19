// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IVault} from '../interfaces/IVault.sol';
import {ProtocolType} from '../libraries/ProtocolType.sol';

/// @dev This contract is used to help with offchain calculations
/// @dev All functions could be called as static
contract VaultViewer {
  function maxWithdraw(address vault, address owner) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).maxWithdraw(owner);
  }

  function maxRedeem(address vault, address owner) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).maxRedeem(owner);
  }

  function convertToAssets(address vault, uint256 shares) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).convertToAssets(shares);
  }

  function convertToShares(address vault, uint256 assets) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).convertToShares(assets);
  }

  function previewDeposit(address vault, uint256 assets) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).previewDeposit(assets);
  }

  function previewMint(address vault, uint256 shares) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).previewMint(shares);
  }

  function previewWithdraw(address vault, uint256 assets) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).previewWithdraw(assets);
  }

  function previewRedeem(address vault, uint256 shares) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).previewRedeem(shares);
  }

  function getTotalLent(address vault) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).getTotalLent();
  }

  function totalAssets(address vault) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).totalAssets();
  }

  function getLentAmount(address vault, ProtocolType protocolType) external returns (uint256) {
    IVault(vault).updateTotalLent();
    return IVault(vault).getLentAmount(protocolType);
  }
}
