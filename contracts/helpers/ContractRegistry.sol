// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from '@openzeppelin/contracts/access/Ownable2Step.sol';

/// @dev This contract is used to help backend to identify new vault deployed in blockchain
contract ContractRegistry is Ownable2Step {
  // 0 - not registered
  // ...
  // 2000 - levva Vault
  event ContractRegistered(uint64 contractType, address contractAddress, bytes data);

  mapping(address vaultAddress => uint64) public contracts;

  constructor() Ownable(msg.sender) {}

  /**
   * @dev Registers a contract with a specific type.
   * @param contractType The type of the contract to register.
   * @param contractAddress The address of the contract to register.
   * @param data An extra data
   */
  function registerContract(uint64 contractType, address contractAddress, bytes calldata data) external onlyOwner {
    if (contracts[contractAddress] != contractType) {
      contracts[contractAddress] = contractType;

      emit ContractRegistered(contractType, contractAddress, data);
    }
  }
}
