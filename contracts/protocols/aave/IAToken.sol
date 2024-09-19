// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// @notice The official IAToken Aave interface duplicates the IERC20 interface, so we use this simple version.
/// https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IAToken.sol#L4
interface IAToken is IERC20 {
  /**
   * @notice Returns the scaled balance of the user.
   * @dev The scaled balance is the sum of all the updated stored balance divided by the reserve's liquidity index
   * at the moment of the update
   * @param user The user whose balance is calculated
   * @return The scaled balance of the user
   */
  function scaledBalanceOf(address user) external view returns (uint256);
}
