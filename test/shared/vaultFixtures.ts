import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { TestVault, TestVault__factory, MintableERC20, MintableERC20__factory } from '../../typechain-types';
import { parseUnits } from 'ethers';

type VaultTestSystem = {
  vault: TestVault;
  asset: MintableERC20;
  owner: SignerWithAddress;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
  user3: SignerWithAddress;
};

export async function deployToken(): Promise<MintableERC20> {
  const [owner] = await ethers.getSigners();
  return new MintableERC20__factory().connect(owner).deploy('Test token', 'TTTT');
}

export async function deployTestVault(): Promise<VaultTestSystem> {
  const [owner, user1, user2, user3] = await ethers.getSigners();

  const token = await deployToken();
  const testVault = (await upgrades.deployProxy(
    new TestVault__factory().connect(owner),
    [await token.getAddress(), 'Levva LP ' + +(await token.symbol()), 'lvv' + (await token.symbol())],
    {
      initializer: 'initialize',
    }
  )) as any as TestVault;

  await token.mint(owner, parseUnits('10000', 18));
  await token.mint(user1, parseUnits('1000', 18));
  await token.mint(user2, parseUnits('1000', 18));

  return {
    vault: testVault,
    asset: token,
    owner: owner,
    user1,
    user2,
  };
}
