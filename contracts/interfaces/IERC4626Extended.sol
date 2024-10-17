// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';

/// @notice An extension of EIP-4626 supporting improved EOA interactions.
/// @dev https://eips.ethereum.org/EIPS/eip-5143
interface IERC4626Extended is IERC4626 {
  ///@notice Mints shares Vault shares to receiver by depositing exactly assets of underlying tokens.
  ///@dev Overloaded version of ERC-4626’s deposit. MUST revert if depositing assets underlying asset mints less then minShares shares.
  function depositWithSlippage(uint256 assets, address receiver, uint256 minShares) external returns (uint256);

  ///@notice Mints exactly shares Vault shares to receiver by depositing assets of underlying tokens.
  ///@dev Overloaded version of ERC-4626’s mint. MUST revert if minting shares shares cost more then maxAssets underlying tokens.
  function mintWithSlippage(uint256 shares, address receiver, uint256 maxAssets) external returns (uint256);

  ///@notice Burns shares from owner and sends exactly assets of underlying tokens to receiver.
  ///@dev Overloaded version of ERC-4626’s withdraw. MUST revert if withdrawing assets underlying tokens requires burning more then maxShares shares.
  function withdrawWithSlippage(
    uint256 assets,
    address receiver,
    address owner,
    uint256 maxShares
  ) external returns (uint256);

  ///@notice Burns exactly shares from owner and sends assets of underlying tokens to receiver.
  ///@dev Overloaded version of ERC-4626’s redeem. MUST revert if redeeming shares shares sends less than minAssets underlying tokens to receiver.
  function redeemWithSlippage(
    uint256 shares,
    address receiver,
    address owner,
    uint256 minAssets
  ) external returns (uint256);
}
