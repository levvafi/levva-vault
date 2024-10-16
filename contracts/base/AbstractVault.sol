// SPDX-License-Identifier: BUSL-1.1
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
import {IERC4626Extended} from '../interfaces/IERC4626Extended.sol';

/// @title
/// @dev Abstract vault implemented ERC-4626
/// @dev Conversion to shares/ to assets same as https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/token/ERC20/extensions/ERC4626.sol
abstract contract AbstractVault is Initializable, ERC4626Upgradeable, IERC4626Extended {
  using SafeERC20 for IERC20;
  using Math for uint256;

  /// @dev 'AbstractVaultStorage' storage slot address
  /// @dev keccak256(abi.encode(uint256(keccak256("levva-vault.AbstractVaultStorage")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant AbstractVaultStorageLocation =
    0x49109aeecddca9f827add183fa69379d0e11dae01df8ce2ddd96e6edafb2f100;

  /// @custom:storage-location erc7201:levva-vault.AbstractVaultStorage
  struct AbstractVaultStorage {
    uint256 _minDeposit;
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

  function _getTotalLent() internal view virtual returns (uint256);

  function _getFreeAmount() internal view returns (uint256 freeAmount) {
    return IERC20(asset()).balanceOf(address(this));
  }

  function _getMinDeposit() internal view returns (uint256) {
    return _getAbstractVaultStorage()._minDeposit;
  }

  function _setMinDeposit(uint256 minDeposit) internal {
    AbstractVaultStorage storage $ = _getAbstractVaultStorage();
    $._minDeposit = minDeposit;
  }

  //// ERC4626 methods

  function _convertToShares(uint256 assets, Math.Rounding rounding) internal view override returns (uint256 shares) {
    shares = assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(), _getTotalLent() + _getFreeAmount() + 1, rounding);
  }

  function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view override returns (uint256 assets) {
    assets = shares.mulDiv(_getTotalLent() + _getFreeAmount() + 1, totalSupply() + 10 ** _decimalsOffset(), rounding);
  }

  /// @inheritdoc IERC4626
  function totalAssets() public view override(IERC4626, ERC4626Upgradeable) returns (uint256 totalManagedAssets) {
    totalManagedAssets = _getFreeAmount() + _getTotalLent();
  }

  /// @inheritdoc IERC4626
  function deposit(uint256 assets, address receiver) public override(IERC4626, ERC4626Upgradeable) returns (uint256) {
    if (assets < _getMinDeposit()) {
      revert Errors.LessThanMinDeposit();
    }

    return super.deposit(assets, receiver);
  }

  /// @inheritdoc IERC4626
  function mint(uint256 shares, address receiver) public override(IERC4626, ERC4626Upgradeable) returns (uint256) {
    uint256 maxShares = maxMint(receiver);
    if (shares > maxShares) {
      revert ERC4626ExceededMaxMint(receiver, shares, maxShares);
    }

    uint256 assets = previewMint(shares);
    if (assets < _getMinDeposit()) {
      revert Errors.LessThanMinDeposit();
    }

    _deposit(_msgSender(), receiver, assets, shares);

    return assets;
  }

  /// ERC-5143 methods, an extension of ERC-4626

  /// @inheritdoc IERC4626Extended
  function depositWithSlippage(uint256 assets, address receiver, uint256 minShares) public returns (uint256) {
    uint256 shares = deposit(assets, receiver);
    if (shares < minShares) {
      revert Errors.DepositSlippageProtection();
    }
    return shares;
  }

  /// @inheritdoc IERC4626Extended
  function mintWithSlippage(uint256 shares, address receiver, uint256 maxAssets) public returns (uint256) {
    uint256 assets = mint(shares, receiver);
    if (assets > maxAssets) {
      revert Errors.MintSlippageProtection();
    }
    return assets;
  }

  /// @inheritdoc IERC4626Extended
  function redeemWithSlippage(
    uint256 shares,
    address receiver,
    address owner,
    uint256 minAssets
  ) public returns (uint256) {
    uint256 assets = redeem(shares, receiver, owner);
    if (assets < minAssets) {
      revert Errors.RedeemSlippageProtection();
    }
    return assets;
  }

  /// @inheritdoc IERC4626Extended
  function withdrawWithSlippage(
    uint256 assets,
    address receiver,
    address owner,
    uint256 maxShares
  ) public returns (uint256) {
    uint256 shares = withdraw(assets, receiver, owner);
    if (shares > maxShares) {
      revert Errors.WithdrawSlippageProtection();
    }
    return shares;
  }
}
