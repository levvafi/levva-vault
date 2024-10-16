// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/// @title Error library
library Errors {
  error ZeroAddress();
  error ZeroAmount();
  error ZeroShares();
  error LessThanMinDeposit();
  error NotEnoughFreeAmount();
  error SenderIsNotVaultManager();
  error UnknownPool();
  error PoolAlreadyAdded();
  error PoolsLimitReached();
  error WrongMarginlyPool();
  error VaultHasPositionInPool();
  error UnknownToken();
  error SenderIsNotVault();
  error AdapterIsNotSet();
  error InvalidWithdrawType();
  error NoUnstakeRequest();
  error InvalidWithdrawRequest();
  error NoElementWithIndex(uint128 index);
  error NoNeedToRequestWithdraw();
}
