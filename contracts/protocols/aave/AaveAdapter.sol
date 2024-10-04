// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';

import {WadRayMath} from '@aave/core-v3/contracts/protocol/libraries/math/WadRayMath.sol';
import {IPool} from '@aave/core-v3/contracts/interfaces/IPool.sol';

import {IAToken} from './IAToken.sol';

import {ILendingAdapter} from '../../interfaces/ILendingAdapter.sol';
import {ConfigManagerStorage} from '../../base/ConfigManagerStorage.sol';
import {AaveAdapterConfigStorage} from './AaveAdapterConfigStorage.sol';

import {IVault} from '../../interfaces/IVault.sol';

/// @title AaveAdapter
/// @notice Adapter contract for interacting with the Aave v3 protocol
/// @dev This contract implements the ILendingAdapter interface and inherits from ConfigManagerStorage
/// @dev It provides methods for supplying assets to and withdrawing assets from Aave v3 pools
/// @dev The contract functions should be called in Vault contract context by using delegatecall
contract AaveAdapter is ILendingAdapter, ConfigManagerStorage {
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;

  /// @notice Supplies a specified amount of assets to the Aave pool
  /// @dev This function approves the Aave pool to spend the underlying asset and then supplies it
  function supply(uint256 amount) external returns (uint256) {
    address aavePool = AaveAdapterConfigStorage(_getConfigManager()).getAavePool();
    address underlyingAsset = IERC4626(address(this)).asset();
    IERC20(underlyingAsset).forceApprove(aavePool, amount);
    IPool(aavePool).supply(underlyingAsset, amount, address(this), 0);

    return amount;
  }

  /// @notice Withdraws a specified amount of assets from the Aave pool
  /// @dev This function interacts with the Aave pool to withdraw the underlying asset
  /// @return withdrawn The actual amount of assets that were withdrawn
  function withdraw(uint256 amount) external returns (uint256 withdrawn) {
    address aavePool = AaveAdapterConfigStorage(_getConfigManager()).getAavePool();
    address underlyingAsset = IERC4626(address(this)).asset();
    withdrawn = IPool(aavePool).withdraw(underlyingAsset, amount, address(this));
  }

  /// @notice Updates the total amount lent to the Aave pool
  /// @dev This function calculates the current balance of aTokens held by this contract
  /// and converts it to the underlying asset amount using the current exchange rate
  /// @return The total amount of underlying assets currently lent to Aave

  function updateLentAmount() external view returns (uint256) {
    return getLentAmount(address(this));
  }

  /// @notice Returns the total amount of underlying assets currently lent to Aave
  /// @return The total amount of underlying assets currently lent to Aave
  function getLentAmount(address vault) public view returns (uint256) {
    address configManager = IVault(vault).getConfigManager();
    address aavePool = AaveAdapterConfigStorage(configManager).getAavePool();
    address underlyingAsset = IERC4626(vault).asset();
    uint256 scaledAmount = IAToken(IPool(aavePool).getReserveData(underlyingAsset).aTokenAddress).scaledBalanceOf(
      vault
    );
    return scaledAmount.rayMul(IPool(aavePool).getReserveNormalizedIncome(underlyingAsset));
  }
}
