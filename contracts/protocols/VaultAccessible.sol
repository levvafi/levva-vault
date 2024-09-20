// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

abstract contract VaultAccessible {
  function _enforceSenderIsVault() internal view virtual;
}
