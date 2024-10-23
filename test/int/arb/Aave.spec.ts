import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import {
  Vault,
  Vault__factory,
  IWeth9,
  IWeth9__factory,
  ConfigManager,
  ConfigManager__factory,
  AaveAdapter,
  AaveAdapter__factory,
  IVault,
} from '../../../typechain-types';
import { logVaultState, ProtocolType, encodeAaveDeposit, encodeAaveWithdraw } from '../../shared/utils';
import { parseUnits, ZeroAddress } from 'ethers';

const wethAddress = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const aavePoolAddressProvider = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';

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
      redeployImplementation: 'always', // only for tests
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
      redeployImplementation: 'always', // only for tests
    }
  )) as any as Vault;

  await configManager.connect(owner).addVault(vault, true);

  const aaveAdapter = (await new AaveAdapter__factory().connect(owner).deploy()) as any as AaveAdapter;

  await vault.connect(owner).addVaultManager(vaultManager.address, true);
  await vault.connect(owner).addLendingAdapter(ProtocolType.Aave, aaveAdapter);
  await configManager.connect(owner).setAavePoolAddressProvider(aavePoolAddressProvider);
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
  it('supply and withdraw', async () => {
    const supplAmount = parseUnits('14', 18);
    const supplyAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Aave,
      data: encodeAaveDeposit(supplAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([supplyAction]);

    await logVaultState(vault, '\nafter aave supply');

    const withdrawAmount = parseUnits('4', 18);
    const withdrawAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Aave,
      data: encodeAaveWithdraw(withdrawAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([withdrawAction]);

    await logVaultState(vault, 'after first withdraw');

    const withdrawAmount2 = ethers.MaxUint256;
    const withdrawAction2: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Aave,
      data: encodeAaveWithdraw(withdrawAmount2),
    };
    await vault.connect(vaultManager).executeProtocolAction([withdrawAction2]);

    await logVaultState(vault, 'after second withdraw');
  });

  it('min deposit amount', async () => {
    const supplAmount = 1n;
    const supplyAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Aave,
      data: encodeAaveDeposit(supplAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([supplyAction]);

    await logVaultState(vault, '\nafter aave supply');
  });
});
