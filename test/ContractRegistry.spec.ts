import { ethers } from 'hardhat';
import { expect } from 'chai';
import { ContractRegistry, ContractRegistry__factory } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('ContractRegistry', () => {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let contractRegistry: ContractRegistry;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    contractRegistry = (await new ContractRegistry__factory().connect(owner).deploy()) as any as ContractRegistry;
  });

  it('registerContract should fail when not authorized', async () => {
    const contractAddress = '0x0000000000000000000000000000000000000001';
    const contractType = 1;

    await expect(
      contractRegistry.connect(user).registerContract(contractType, contractAddress, '0x')
    ).to.be.revertedWithCustomError(contractRegistry, 'OwnableUnauthorizedAccount');
  });

  it('register contract', async () => {
    const contractAddress = '0x0000000000000000000000000000000000000001';
    const contractType = 1;
    const data = '0x234556';

    expect(await contractRegistry.contracts(contractAddress)).to.eq(0);

    await expect(contractRegistry.connect(owner).registerContract(contractType, contractAddress, data))
      .to.emit(contractRegistry, 'ContractRegistered')
      .withArgs(contractType, contractAddress, data);

    expect(await contractRegistry.contracts(contractAddress)).to.eq(contractType);
  });

  it('register contract shoud not emit event when duplicate', async () => {
    const contractAddress = '0x0000000000000000000000000000000000000001';
    const contractType = 1;
    const data = '0x234556';

    await contractRegistry.connect(owner).registerContract(contractType, contractAddress, data);

    await expect(contractRegistry.connect(owner).registerContract(contractType, contractAddress, data)).not.to.emit(
      contractRegistry,
      'ContractRegistered'
    );
  });
});
