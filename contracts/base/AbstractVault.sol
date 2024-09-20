// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ERC20Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import {ERC4626Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol';
import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {IERC20} from '@openzeppelin/contracts/interfaces/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/interfaces/IERC20Metadata.sol';
import {Math} from '@openzeppelin/contracts/utils/math/Math.sol';
import {Errors} from '../libraries/Errors.sol';

/// @title
/// @dev Abstract vault implemented ERC-4626
/// @dev Conversion to shares/ to assets same as https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/token/ERC20/extensions/ERC4626.sol
abstract contract AbstractVault is Initializable, ERC4626Upgradeable {
  using SafeERC20 for IERC20;
  using Math for uint256;

  /// @dev 'AbstractVaultStorage' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.AbstractVaultStorage")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant AbstractVaultStorageLocation =
    0x49109aeecddca9f827add183fa69379d0e11dae01df8ce2ddd96e6edafb2f100;

  /// @custom:storage-location erc7201:levva-vault.AbstractVaultStorage
  struct AbstractVaultStorage {
    ///@dev cached value of total lent, actual value could change every time, to get actual value call _updateTotalLent()
    uint256 _totalLent;
    uint256 _totalLentUpdatedAt;
  }

  function __AbstractVault_init(
    address _asset,
    string memory lpName,
    string memory lpSymbol
  ) internal onlyInitializing {
    __ERC4626_init(IERC20(_asset));

    __ERC20_init(lpName, lpSymbol);
  }

  /// Storage

  /// @dev returns storage slot of 'VaultData' struct
  function _getAbstractVaultStorage() private pure returns (AbstractVaultStorage storage $) {
    assembly {
      $.slot := AbstractVaultStorageLocation
    }
  }

  function _getTotalLent() internal view returns (uint256) {
    return _getAbstractVaultStorage()._totalLent;
  }

  function _getTotalLentUpdatedAt() internal view returns (uint256) {
    return _getAbstractVaultStorage()._totalLentUpdatedAt;
  }

  function _getFreeAmount() internal view returns (uint256 freeAmount) {
    return IERC20(asset()).balanceOf(address(this));
  }

  function _setTotalLent(uint256 totaLent, uint256 _timestamp) internal {
    AbstractVaultStorage storage $ = _getAbstractVaultStorage();
    $._totalLent = totaLent;
    $._totalLentUpdatedAt = _timestamp;
  }

  /// @dev Updates total lent values
  function _updateTotalLent() internal virtual returns (uint256);

  //// ERC4626 methods

  function _convertToShares(uint256 assets, Math.Rounding rounding) internal view override returns (uint256 shares) {
    AbstractVaultStorage storage $ = _getAbstractVaultStorage();
    shares = assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(), $._totalLent + _getFreeAmount() + 1, rounding);
  }

  function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view override returns (uint256 assets) {
    AbstractVaultStorage storage $ = _getAbstractVaultStorage();
    assets = shares.mulDiv($._totalLent + _getFreeAmount() + 1, totalSupply() + 10 ** _decimalsOffset(), rounding);
  }

  /// @inheritdoc IERC4626
  function totalAssets() public view override returns (uint256 totalManagedAssets) {
    AbstractVaultStorage storage $ = _getAbstractVaultStorage();
    totalManagedAssets = _getFreeAmount() + $._totalLent;
  }

  /// @inheritdoc IERC4626
  function deposit(uint256 assets, address receiver) public override returns (uint256) {
    _updateTotalLent();
    return super.deposit(assets, receiver);
  }

  /// @inheritdoc IERC4626
  function mint(uint256 shares, address receiver) public override returns (uint256) {
    _updateTotalLent();
    return super.mint(shares, receiver);
  }

  /// @inheritdoc IERC4626
  function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
    _updateTotalLent();
    return super.withdraw(assets, receiver, owner);
  }

  /// @inheritdoc IERC4626
  function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
    _updateTotalLent();
    return super.redeem(shares, receiver, owner);
  }
}
