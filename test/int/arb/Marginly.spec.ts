import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ERC20 } from '../../../typechain-types/@openzeppelin/contracts/token/ERC20';
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
} from '../../../typechain-types';
import {
  ArbAddressData,
  encodeMarginlyDeposit,
  encodeMarginlyWithdraw,
  logVaultState,
  ProtocolType,
  setTokenBalance,
  shiftTime,
} from '../../shared/utils';
import { Addressable, formatUnits, parseEther, parseUnits, ZeroAddress } from 'ethers';
import { mine, reset, time } from '@nomicfoundation/hardhat-network-helpers';

const wethAddress = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const marginlyPool_PtUsde_USDC_Address = '0x760B9fE6b1f6c5dD7597A02690ffe3F6a07a3042';
const marginlyPool_PtgUSDC_USDC_Address = '0x230A545aBE3217BA3BdA3EEec2D8582dFD4B73CE';
const marginlyPool_USDE_USDC_Address = '0x9007A45304Ac6676CEf22ec68c870ae88Af60065';

const usdeHolderAddress = '0x99F4176EE457afedFfCB1839c7aB7A030a5e4A92';
const ptUsdeHolderAddress = '0x4DfD5f7Dd019F2F9Fc4D954FF3aDD3348839845d';
const ptUsdeHolder2Address = '0x23ABdAF99c0da073b2F51515190d37674Ca7d404';
const ptgUSDCHolderAddress = '0x1754f738710e337012be0CcC10B37a2930a85aFf';

let vault: Vault;
let owner: SignerWithAddress;
let vaultManager: SignerWithAddress;
let user: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let usdeHolder: SignerWithAddress;
let ptUsdeHolder: SignerWithAddress;
let ptUsdeHolder2: SignerWithAddress;
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

  const initialAmount = parseUnits('100000', 6);
  await setUsdcBalance(user.address, initialAmount);
  await setUsdcBalance(user2.address, initialAmount);
  await setUsdcBalance(user3.address, initialAmount);
  await setUsdcBalance(techPositionUser.address, initialAmount);

  // fund holders with 1 eth
  for (const holder of [usdeHolderAddress, ptUsdeHolderAddress, ptgUSDCHolderAddress, ptUsdeHolder2Address]) {
    await owner.sendTransaction({
      to: holder,
      value: parseEther('1'),
    });
  }

  usdeHolder = await ethers.getImpersonatedSigner(usdeHolderAddress);
  ptUsdeHolder = await ethers.getImpersonatedSigner(ptUsdeHolderAddress);
  ptUsdeHolder2 = await ethers.getImpersonatedSigner(ptUsdeHolder2Address);
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

async function getRealQuoteAmount(positionAddress: Addressable, marginlyPool: IMarginlyPool) {
  const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
  const position = await marginlyPool.positions(positionAddress);
  return (quoteCollateralCoeff.inner * position.discountedQuoteAmount) / 2n ** 96n;
}

describe('Marginly', () => {
  beforeEach(async () => {
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
  });

  it('deposit and withdraw from marginly', async () => {
    console.log(`Vault totalSupply is ${formatUnits(await vault.totalSupply(), 6)}`);
    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);
    console.log(`Lp price is ${formatUnits(await vault.convertToAssets(parseUnits('1', 6)), 6)} USDC`);

    const depositAmount1 = parseUnits('2000', 6);
    const depositAction1: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount1),
    };

    await vault.connect(vaultManager).executeProtocolAction([depositAction1]);
    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);

    const quoteToken = ERC20__factory.connect(await marginlyPool_PtUsde_USDC.quoteToken(), ptUsdeHolder.provider);
    const baseToken = ERC20__factory.connect(await marginlyPool_PtUsde_USDC.baseToken(), ptUsdeHolder.provider);

    console.log(`\nMarginly quote balance is ${formatUnits(await quoteToken.balanceOf(marginlyPool_PtUsde_USDC), 6)}`);
    console.log(
      `Marginly base token balance is ${formatUnits(await baseToken.balanceOf(marginlyPool_PtUsde_USDC), 18)}`
    );
    console.log(`\nLong with high leverage: deposit 100, long 1850`);

    await marginlyLong(ptUsdeHolder, marginlyPool_PtUsde_USDC, parseUnits('100', 18), parseUnits('1850', 18));

    console.log(`\nMarginly quote balance is ${formatUnits(await quoteToken.balanceOf(marginlyPool_PtUsde_USDC), 6)}`);
    console.log(
      `Marginly base token balance is ${formatUnits(await baseToken.balanceOf(marginlyPool_PtUsde_USDC), 18)}`
    );

    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);
    console.log(`Vault totalLent is ${formatUnits(await vault.getTotalLent(), 6)}`);

    console.log(`\nWait 1 month to make margin call`);
    await shiftTime(30 * 24 * 60 * 60);

    let totalLent = await vault.getTotalLent();
    console.log(`Vault totalLent is ${formatUnits(totalLent, 6)}`);

    console.log(`\nReinit marginly and getTotalLent`);
    await marginlyReinit(ptUsdeHolder, marginlyPool_PtUsde_USDC);
    totalLent = await vault.getTotalLent();
    console.log(`Vault totalLent is ${formatUnits(totalLent, 6)}`);

    const withdrawAmount = (totalLent * 110n) / 100n;
    const withdrawAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyWithdraw(marginlyPool_PtUsde_USDC_Address, withdrawAmount),
    };

    await vault.connect(vaultManager).executeProtocolAction([withdrawAction]);

    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);
    console.log(`Vault totalLent is ${formatUnits(await vault.getTotalLent(), 6)}`);
    console.log(`Lp price is ${formatUnits(await vault.convertToAssets(parseUnits('1', 6)), 6)} USDC`);
  });

  it('deposit and could not withdraw all lent amount', async () => {
    console.log(`Vault totalSupply is ${formatUnits(await vault.totalSupply(), 6)}`);
    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);
    console.log(`Lp price is ${formatUnits(await vault.convertToAssets(parseUnits('1', 6)), 6)} USDC`);

    const depositAmount1 = parseUnits('2000', 6);
    const depositAction1: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount1),
    };

    await vault.connect(vaultManager).executeProtocolAction([depositAction1]);
    console.log(`\nVault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);

    await marginlyLong(ptUsdeHolder, marginlyPool_PtUsde_USDC, parseUnits('100', 18), parseUnits('200', 18));

    console.log(`\nWait 1 month to make margin call`);
    await shiftTime(10 * 24 * 60 * 60);

    const quoteToken = ERC20__factory.connect(await marginlyPool_PtUsde_USDC.quoteToken(), ptUsdeHolder.provider);

    const totalLent = await vault.getTotalLent();
    console.log(`Vault totalLent is ${formatUnits(totalLent, 6)}`);
    const maxAvailableForWithdraw = await quoteToken.balanceOf(marginlyPool_PtUsde_USDC);
    console.log(`Max available for withdraw from marginly is ${formatUnits(maxAvailableForWithdraw, 6)}`);

    let withdrawAmount = totalLent;
    let withdrawAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyWithdraw(marginlyPool_PtUsde_USDC_Address, withdrawAmount),
    };
    await expect(vault.connect(vaultManager).executeProtocolAction([withdrawAction])).to.be.revertedWith('ST');

    withdrawAmount = maxAvailableForWithdraw;
    withdrawAction = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyWithdraw(marginlyPool_PtUsde_USDC_Address, withdrawAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([withdrawAction]);
    console.log(`\nVault totalLent is ${formatUnits(await vault.getTotalLent(), 6)}`);
    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);
    console.log(`\nMarginly quote balance is ${formatUnits(await quoteToken.balanceOf(marginlyPool_PtUsde_USDC), 6)}`);
  });

  it('min deposit amount', async () => {
    const depositAmount = 10n;
    const supplyAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([supplyAction]);

    await logVaultState(vault, '\nafter marginly deposit');
  });

  it('total lent without MC', async () => {
    // Here we check correctness of getTotalLent amount
    // we calculate getTotalLent amount after some period of time without reinits
    // than make reinit and check that getTotalLent amount is the same as reinit
    console.log(`\nCurrent blockNumber is ${await owner.provider.getBlockNumber()}`);

    const depositAmount1 = parseUnits('2000', 6);
    const depositAction1: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount1),
    };

    await vault.connect(vaultManager).executeProtocolAction([depositAction1]);
    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);

    console.log(`\nLong with high leverage: deposit 500, long 1850`);

    await marginlyLong(ptUsdeHolder, marginlyPool_PtUsde_USDC, parseUnits('500', 18), parseUnits('1850', 18));

    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);
    console.log(`Vault totalLent is ${formatUnits(await vault.getTotalLent(), 6)}`);

    console.log(`\nWait 5 days`);
    await shiftTime(5 * 24 * 60 * 60);

    const totalLentBeforeReinit = await vault.getTotalLent();
    console.log(`Vault totalLent is ${formatUnits(totalLentBeforeReinit, 6)}`);

    //trick to save same blockTime for both reinit and getTotalLent
    const currentBlockTimestamp = (await owner.provider.getBlock(await owner.provider.getBlockNumber()))?.timestamp!;
    await time.setNextBlockTimestamp(currentBlockTimestamp);

    console.log(`\nReinit marginly and getTotalLent`);
    await marginlyReinit(ptUsdeHolder, marginlyPool_PtUsde_USDC);

    const totalLentAfterReinit = await vault.getTotalLent();
    console.log(`Vault totalLent is ${formatUnits(totalLentAfterReinit, 6)}`);

    const realQuoteAmountByMarginly = await getRealQuoteAmount(vault, marginlyPool_PtUsde_USDC);
    console.log(`Marginly vault position realQuoteAmount is ${formatUnits(realQuoteAmountByMarginly, 6)}`);

    expect(totalLentBeforeReinit).to.eq(totalLentAfterReinit);
    expect(totalLentAfterReinit).to.eq(realQuoteAmountByMarginly);
  });

  it('total lent with MC', async () => {
    // Here we ensure that getTotalLent less than after reinit with MC
    console.log(`\nCurrent blockNumber is ${await owner.provider.getBlockNumber()}`);

    const depositAmount1 = parseUnits('2000', 6);
    const depositAction1: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyDeposit(marginlyPool_PtUsde_USDC_Address, depositAmount1),
    };

    await vault.connect(vaultManager).executeProtocolAction([depositAction1]);
    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);

    console.log(`\nLong with high leverage: deposit 100, long 1850`);

    await marginlyLong(ptUsdeHolder2, marginlyPool_PtUsde_USDC, parseUnits('100', 18), parseUnits('1850', 18));

    console.log(`Vault free amount is ${formatUnits(await vault.getFreeAmount(), 6)}`);
    console.log(`Vault totalLent is ${formatUnits(await vault.getTotalLent(), 6)}`);

    console.log(`\nWait 20 days`);
    await shiftTime(20 * 24 * 60 * 60);

    const totalLentBeforeReinit = await vault.getTotalLent();
    console.log(`Vault totalLent is ${formatUnits(totalLentBeforeReinit, 6)}`);

    //trick to save same blockTime for both reinit and getTotalLent
    const currentBlockTimestamp = (await owner.provider.getBlock(await owner.provider.getBlockNumber()))?.timestamp!;
    await time.setNextBlockTimestamp(currentBlockTimestamp);

    console.log(`\nReinit marginly and getTotalLent`);
    await marginlyReinit(ptUsdeHolder2, marginlyPool_PtUsde_USDC);

    const totalLentAfterReinit = await vault.getTotalLent();
    console.log(`Vault totalLent is ${formatUnits(totalLentAfterReinit, 6)}`);

    const realQuoteAmountByMarginly = await getRealQuoteAmount(vault, marginlyPool_PtUsde_USDC);
    console.log(`Marginly vault position realQuoteAmount is ${formatUnits(realQuoteAmountByMarginly, 6)}`);

    expect(totalLentBeforeReinit).to.lt(totalLentAfterReinit);
    expect(totalLentAfterReinit).to.eq(realQuoteAmountByMarginly);
  });
});
