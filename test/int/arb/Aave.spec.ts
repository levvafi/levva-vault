import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect, use } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { IERC20 } from '../../../typechain-types/@openzeppelin/contracts/token/ERC20';
import {
  ERC20__factory,
  Vault,
  Vault__factory,
  IWeth9,
  IWeth9__factory,
  ConfigManager,
  ConfigManager__factory,
  AaveAdapter,
  AaveAdapter__factory,
} from '../../../typechain-types';
import { ArbAddressData, setTokenBalance, shiftTime, logVaultState, ProtocolType } from '../../shared/utils';
import { formatUnits, parseUnits, ZeroAddress } from 'ethers';

const wethAddress = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const aavePoolAddress = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';

let vault: Vault;
let owner: SignerWithAddress;
let vaultManager: SignerWithAddress;
let user: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let techPositionUser: SignerWithAddress;
let weth: IWeth9;
let configManager: ConfigManager;

async function deployVaultWithAaveAdapter() {
  [owner, vaultManager, user, user2, user3, techPositionUser] = await ethers.getSigners();
  weth = IWeth9__factory.connect(wethAddress, owner.provider);

  configManager = (await upgrades.deployProxy(
    new ConfigManager__factory().connect(owner),
    [
      wethAddress, // weth address
      ZeroAddress, // weETH address
    ],
    {
      initializer: 'initialize',
    }
  )) as any as ConfigManager;

  vault = (await upgrades.deployProxy(
    new Vault__factory().connect(owner),
    [
      wethAddress, // asset
      'Levva LP WETH', // lp name
      'lvvWETH', // lp symbol
      await configManager.getAddress(), // configManager address
    ],
    {
      initializer: 'initialize',
      unsafeAllow: ['delegatecall'],
    }
  )) as any as Vault;

  await configManager.connect(owner).addVault(vault, true);

  const aaveAdapter = (await new AaveAdapter__factory().connect(owner).deploy()) as any as AaveAdapter;

  await vault.connect(owner).addVaultManager(vaultManager.address, true);
  await vault.connect(owner).addLendingAdapter(1, aaveAdapter);
  await configManager.connect(owner).setAavePool(aavePoolAddress);
}

before(async () => {
  await deployVaultWithAaveAdapter();

  //initialize vault with 15 eth from 3 users
  const depositAmount = parseUnits('5', 18);
  const approveAmount = parseUnits('10000', 18);
  for (const usr of [user, user2, user3]) {
    await weth.connect(usr).deposit({ value: depositAmount });
    await weth.connect(usr).approve(vault, approveAmount);
    await vault.connect(usr).deposit(depositAmount, usr);
  }

  // make special technical position
  const technicalPositionAmount = parseUnits('0.0001', 18);
  await weth.connect(techPositionUser).deposit({ value: technicalPositionAmount });
  await weth.connect(techPositionUser).approve(vault, technicalPositionAmount);
  await vault.connect(techPositionUser).deposit(technicalPositionAmount, techPositionUser);
});

describe('Aave', () => {
  it('seed and harvest', async () => {
    const seedAmount = parseUnits('14', 18);

    const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
    await vault.connect(vaultManager).seed(ProtocolType.Aave, seedData);
    await vault.updateTotalLent();

    await logVaultState(vault, 'after seed');

    const harvestAmount1 = parseUnits('4', 18);
    const harvestData1 = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [harvestAmount1]);
    await vault.connect(vaultManager).harvest(ProtocolType.Aave, harvestData1);
    await vault.updateTotalLent();

    await logVaultState(vault, 'after first harvest');

    const harvestAmount2 = ethers.MaxUint256;
    const harvestData2 = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [harvestAmount2]);
    console.log('harvestAmount2', formatUnits(harvestAmount2, 18));
    await vault.connect(vaultManager).harvest(ProtocolType.Aave, harvestData2);
    await vault.updateTotalLent();

    await logVaultState(vault, 'after second harvest');
  });
});
