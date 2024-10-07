import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ERC20 } from '../../typechain-types/@openzeppelin/contracts/token/ERC20';
import {
  IWeth9__factory,
  Vault,
  IWeth9,
  ConfigManager,
  ConfigManager__factory,
  Vault__factory,
  MarginlyAdapter__factory,
  MarginlyAdapter,
  ERC20__factory,
  IMarginlyPool,
  IMarginlyPool__factory,
  IVault,
  AaveAdapter__factory,
  AaveAdapter,
} from '../../typechain-types';
import {
  ArbAddressData,
  encodeAaveDeposit,
  encodeMarginlyDeposit,
  encodeAaveWithdraw,
  ProtocolType,
  setTokenBalance,
  encodeMarginlyWithdraw,
} from '../shared/utils';
import { parseEther, parseUnits, ZeroAddress } from 'ethers';
import { snapshotGasCost } from '../shared/utils';
const wethAddress = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const marginlyPool_PtUsde_USDC_Address = '0x760B9fE6b1f6c5dD7597A02690ffe3F6a07a3042';
const marginlyPool_PtgUSDC_USDC_Address = '0x230A545aBE3217BA3BdA3EEec2D8582dFD4B73CE';
const marginlyPool_USDE_USDC_Address = '0x9007A45304Ac6676CEf22ec68c870ae88Af60065';

const aavePoolAddress = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';

const usdeHolderAddress = '0x99F4176EE457afedFfCB1839c7aB7A030a5e4A92';
const ptUsdeHolderAddress = '0x4DfD5f7Dd019F2F9Fc4D954FF3aDD3348839845d';
const ptgUSDCHolderAddress = '0x1754f738710e337012be0CcC10B37a2930a85aFf';

let vault: Vault;
let owner: SignerWithAddress;
let vaultManager: SignerWithAddress;
let user: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let usdeHolder: SignerWithAddress;
let ptUsdeHolder: SignerWithAddress;
let ptgUSDCHolder: SignerWithAddress;
let techPositionUser: SignerWithAddress;
let weth: IWeth9;
let usdc: ERC20;
let configManager: ConfigManager;
let marginlyPool_PtUsde_USDC: IMarginlyPool;
let marginlyPool_PtgUSDC_USDC: IMarginlyPool;
let marginlyPool_USDE_USDC: IMarginlyPool;

async function deployVaultWithMarginlyAdapter() {
  [owner, vaultManager, user, user2, user3, techPositionUser] = await ethers.getSigners();
  weth = IWeth9__factory.connect(wethAddress, owner.provider);
  usdc = ERC20__factory.connect(ArbAddressData.usdc, owner.provider);

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
      ArbAddressData.usdc, // asset
      'Levva LP USDC', // lp name
      'lvvUSDC', // lp symbol
      await configManager.getAddress(), // configManager address
    ],
    {
      initializer: 'initialize',
      unsafeAllow: ['delegatecall'],
    }
  )) as any as Vault;

  await configManager.connect(owner).addVault(vault, true);

  const marginlyAdapter = (await new MarginlyAdapter__factory().connect(owner).deploy()) as any as MarginlyAdapter;

  await vault.connect(owner).addVaultManager(vaultManager.address, true);
  await vault.connect(owner).addLendingAdapter(ProtocolType.Marginly, marginlyAdapter);
  await configManager.connect(owner).addMarginlyPool(vault, marginlyPool_PtUsde_USDC_Address);
  await configManager.connect(owner).addMarginlyPool(vault, marginlyPool_PtgUSDC_USDC_Address);
  await configManager.connect(owner).addMarginlyPool(vault, marginlyPool_USDE_USDC_Address);

  const aaveAdapter = (await new AaveAdapter__factory().connect(owner).deploy()) as any as AaveAdapter;

  await vault.connect(owner).addLendingAdapter(ProtocolType.Aave, aaveAdapter);
  await configManager.connect(owner).setAavePool(aavePoolAddress);

  const initialAmount = parseUnits('100000', 6);
  await setUsdcBalance(user.address, initialAmount);
  await setUsdcBalance(user2.address, initialAmount);
  await setUsdcBalance(user3.address, initialAmount);
  await setUsdcBalance(techPositionUser.address, initialAmount);

  // fund holders with 1 eth
  for (const holder of [usdeHolderAddress, ptUsdeHolderAddress, ptgUSDCHolderAddress]) {
    await owner.sendTransaction({
      to: holder,
      value: parseEther('1'),
    });
  }

  usdeHolder = await ethers.getImpersonatedSigner(usdeHolderAddress);
  ptUsdeHolder = await ethers.getImpersonatedSigner(ptUsdeHolderAddress);
  ptgUSDCHolder = await ethers.getImpersonatedSigner(ptgUSDCHolderAddress);

  marginlyPool_PtUsde_USDC = IMarginlyPool__factory.connect(marginlyPool_PtUsde_USDC_Address, owner.provider);
  marginlyPool_PtgUSDC_USDC = IMarginlyPool__factory.connect(marginlyPool_PtgUSDC_USDC_Address, owner.provider);
  marginlyPool_USDE_USDC = IMarginlyPool__factory.connect(marginlyPool_USDE_USDC_Address, owner.provider);
}

async function setUsdcBalance(account: string, amount: bigint) {
  await setTokenBalance(ArbAddressData.usdc, account, amount);
  //console.log(`Account balance is ${await usdc.balanceOf(account)}`);
  expect(await usdc.balanceOf(account)).to.gte(amount);
}

async function marginlyLong(signer: SignerWithAddress, marginlyPool: IMarginlyPool, deposit: bigint, long: bigint) {
  const depositBaseCallType = 0;
  const limitPriceX96 = ((await marginlyPool.getBasePrice()).inner * 125n) / 100n;
  const swapCallData = await marginlyPool.defaultSwapCallData();

  const baseToken = ERC20__factory.connect(await marginlyPool.baseToken(), signer.provider);
  await baseToken.connect(signer).approve(marginlyPool, deposit);
  await marginlyPool
    .connect(signer)
    .execute(depositBaseCallType, deposit, long, limitPriceX96, false, ZeroAddress, swapCallData);
}

async function marginlyReinit(signer: SignerWithAddress, marginlyPool: IMarginlyPool) {
  const swapCallData = await marginlyPool.defaultSwapCallData();
  await marginlyPool.connect(signer).execute(7, 0, 0, 0, false, ZeroAddress, swapCallData);
}

async function initializeVault() {
  await deployVaultWithMarginlyAdapter();

  //initialize vault with 2000 usdc from 3 users
  const depositAmount = parseUnits('2000', 6);
  for (const usr of [user, user2, user3]) {
    await usdc.connect(usr).approve(vault, depositAmount);
    await vault.connect(usr).deposit(depositAmount, usr);
  }

  // make special technical position
  const technicalPositionAmount = parseUnits('5', 6);
  await usdc.connect(techPositionUser).approve(vault, technicalPositionAmount);
  await vault.connect(techPositionUser).deposit(technicalPositionAmount, techPositionUser);
}

describe('Vault.Arbitrum.', () => {
  describe('Aave.', async () => {
    before(async () => {
      await initializeVault();
    });

    it('userDeposit empty vault', async () => {
      const depositAmount = parseUnits('1000', 6);
      await usdc.connect(user2).approve(vault, depositAmount);
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('executeProtocolAction.Deposit', async () => {
      // deposit 1000 usdc to aave
      const supplAmount = parseUnits('1000', 6);
      const supplyAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Aave,
        data: encodeAaveDeposit(supplAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([supplyAction]));
    });

    it('executeProtocolAction.Withdraw', async () => {
      // deposit 1000 usdc to aave
      const withdrawAmount = parseUnits('500', 6);
      const withdrawAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Aave,
        data: encodeAaveWithdraw(withdrawAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([withdrawAction]));
    });

    it('userDeposit', async () => {
      const depositAmount = parseUnits('1000', 6);
      await usdc.connect(user2).approve(vault, depositAmount);
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('userWithdraw', async () => {
      const withdrawAmount = parseUnits('1000', 6);
      await snapshotGasCost(vault.connect(user2).withdraw(withdrawAmount, user2, user2));
    });
  });

  describe('Marginly1.', async () => {
    before(async () => {
      await initializeVault();
    });

    it('userDeposit empty vault', async () => {
      const depositAmount = parseUnits('1000', 6);
      await usdc.connect(user2).approve(vault, depositAmount);
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('executeProtocolAction.Deposit', async () => {
      // deposit 1000 usdc to marignly
      const depositAmount = parseUnits('1000', 6);
      const depositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([depositAction]));
    });

    it('userDeposit', async () => {
      const depositAmount = parseUnits('1000', 6);
      await usdc.connect(user2).approve(vault, depositAmount);
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('userWithdraw', async () => {
      const withdrawAmount = parseUnits('1000', 6);
      await snapshotGasCost(vault.connect(user2).withdraw(withdrawAmount, user2, user2));
    });

    it('executeProtocolAction.Withdraw', async () => {
      // deposit 1000 usdc to aave
      const withdrawAmount = parseUnits('500', 6);
      const withdrawAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(marginlyPool_PtUsde_USDC_Address, withdrawAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([withdrawAction]));
    });
  });

  describe('Marginly2.', async () => {
    before(async () => {
      await initializeVault();
    });

    it('executeProtocolAction.BatchDeposit', async () => {
      // deposit 1000 usdc to marignly
      const depositAmount = parseUnits('1000', 6);
      const depositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount),
      };
      const depositAction2: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtgUSDC_USDC_Address, depositAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([depositAction, depositAction2]));
    });

    it('userDeposit', async () => {
      const depositAmount = parseUnits('1000', 6);
      await usdc.connect(user2).approve(vault, depositAmount);
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('userWithdraw', async () => {
      const withdrawAmount = parseUnits('1000', 6);
      await snapshotGasCost(vault.connect(user2).withdraw(withdrawAmount, user2, user2));
    });

    it('executeProtocolAction.Withdraw', async () => {
      // deposit 1000 usdc to aave
      const withdrawAmount = parseUnits('500', 6);
      const withdrawAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(marginlyPool_PtUsde_USDC_Address, withdrawAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([withdrawAction]));
    });
  });

  describe('Marginly3.', async () => {
    before(async () => {
      await initializeVault();
    });

    it('executeProtocolAction.Deposit into two connected pools', async () => {
      // deposit 1000 usdc to marignly
      const depositAmount = parseUnits('1000', 6);
      const depositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount),
      };
      const depositAction2: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtgUSDC_USDC_Address, depositAmount),
      };
      const depositAction3: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_USDE_USDC_Address, depositAmount),
      };
      await snapshotGasCost(
        vault.connect(vaultManager).executeProtocolAction([depositAction, depositAction2, depositAction3])
      );
    });

    it('userDeposit', async () => {
      const depositAmount = parseUnits('1000', 6);
      await usdc.connect(user2).approve(vault, depositAmount);
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('userWithdraw', async () => {
      const withdrawAmount = parseUnits('1000', 6);
      await snapshotGasCost(vault.connect(user2).withdraw(withdrawAmount, user2, user2));
    });

    it('executeProtocolAction.Withdraw', async () => {
      // deposit 1000 usdc to aave
      const withdrawAmount = parseUnits('500', 6);
      const withdrawAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(marginlyPool_PtUsde_USDC_Address, withdrawAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([withdrawAction]));
    });
  });

  describe('Aave and Marginly3.', async () => {
    before(async () => {
      await initializeVault();
    });

    it('executeProtocolAction.BatchDeposit', async () => {
      // deposit 1000 usdc to marignly
      const depositAmount = parseUnits('1000', 6);
      const depositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount),
      };
      const depositAction2: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtgUSDC_USDC_Address, depositAmount),
      };
      const depositAction3: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_USDE_USDC_Address, depositAmount),
      };
      const depositAction4: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Aave,
        data: encodeAaveDeposit(depositAmount),
      };
      await snapshotGasCost(
        vault
          .connect(vaultManager)
          .executeProtocolAction([depositAction, depositAction2, depositAction3, depositAction4])
      );
    });

    it('userDeposit', async () => {
      const depositAmount = parseUnits('1000', 6);
      await usdc.connect(user2).approve(vault, depositAmount);
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('userWithdraw', async () => {
      const withdrawAmount = parseUnits('1000', 6);
      await snapshotGasCost(vault.connect(user2).withdraw(withdrawAmount, user2, user2));
    });
  });
});
