import { ethers, formatUnits, parseUnits } from 'ethers';
import { expect, use } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystemWithConfiguredVault } from './shared/fixtures';
import { encodeMarginlyDeposit, ProtocolType } from './shared/utils';
import { MintableERC20, MockMarginlyPool, Vault, VaultViewer } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('VaultViewer', () => {
  let vault: Vault;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let usdc: MintableERC20;
  let vaultViewer: VaultViewer;
  let marginlyPools: MockMarginlyPool[];

  beforeEach(async () => {
    const ts = await loadFixture(deployTestSystemWithConfiguredVault);

    vault = ts.vault;
    user1 = ts.user1;
    user2 = ts.user2;
    vaultViewer = ts.vaultViewer;
    usdc = ts.usdc;
    marginlyPools = ts.marginlyPools;

    //technical deposit
    await usdc.connect(user1).approve(vault, parseUnits('10', 18));
    await vault.connect(user1).deposit(parseUnits('10', 18), user1);
    await vault.connect(user1).updateTotalLent();

    //user deposit
    const depositAmount = parseUnits('100', 18);
    await usdc.connect(user2).approve(vault, depositAmount);
    await vault.connect(user2).deposit(depositAmount, user2);

    const depositMarginlyAmount = parseUnits('100', 18);
    const marginlyDepositAction = {
      protocol: ProtocolType.Marginly,
      data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), depositMarginlyAmount),
    };
    await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

    //simulate profit
    const vaultPosition = await marginlyPools[0].positions(vault);
    await marginlyPools[0].setPosition(vault, {
      _type: 1,
      heapPosition: 0,
      discountedBaseAmount: vaultPosition.discountedBaseAmount * 2n,
      discountedQuoteAmount: vaultPosition.discountedQuoteAmount * 2n,
    });
  });

  it('getTotalLent', async () => {
    const totalLent = await vaultViewer.getTotalLent.staticCall(vault);
    console.log(`totalLent from vaultViewer ${formatUnits(totalLent, 18)}`);
    console.log(`totalLent from vault ${formatUnits(await vault.getTotalLent(), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.getTotalLent()).to.be.eq(totalLent);
  });

  it('getLentAmount', async () => {
    const lentAmount = await vaultViewer.getLentAmount.staticCall(vault, ProtocolType.Marginly);

    console.log(`lentAmount from vaultViewer ${formatUnits(lentAmount, 18)}`);
    console.log(`lentAmount from vault ${formatUnits(await vault.getLentAmount(ProtocolType.Marginly), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.getLentAmount(ProtocolType.Marginly)).to.be.eq(lentAmount);
  });

  it('totalAssets', async () => {
    const totalAssets = await vaultViewer.totalAssets.staticCall(vault);

    console.log(`totalAssets from vault ${formatUnits(await vault.totalAssets(), 18)}`);
    console.log(`totalAssets from vaultViewer ${formatUnits(totalAssets, 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.totalAssets()).to.be.eq(totalAssets);
  });

  it('maxWithdraw', async () => {
    const maxWithdraw = await vaultViewer.maxWithdraw.staticCall(vault, user2);
    console.log(`maxWithdraw from vaultViewer ${formatUnits(maxWithdraw, 18)}`);
    console.log(`maxWithdraw from vault ${formatUnits(await vault.maxWithdraw(user2), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.maxWithdraw(user2)).to.be.eq(maxWithdraw);
  });

  it('maxRedeem', async () => {
    const maxRedeem = await vaultViewer.maxRedeem.staticCall(vault, user2);
    console.log(`maxRedeem from vaultViewer ${formatUnits(maxRedeem, 18)}`);
    console.log(`maxRedeem from vault ${formatUnits(await vault.maxRedeem(user2), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.maxRedeem(user2)).to.be.eq(maxRedeem);
  });

  it('previewWithdraw', async () => {
    const assets = parseUnits('100', 18);

    const previewWithdraw = await vaultViewer.previewWithdraw.staticCall(vault, assets);
    console.log(`previewWithdraw from vaultViewer ${formatUnits(previewWithdraw, 18)}`);
    console.log(`previewWithdraw from vault ${formatUnits(await vault.previewWithdraw(assets), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.previewWithdraw(assets)).to.be.eq(previewWithdraw);
  });

  it('previewDeposit', async () => {
    const assets = parseUnits('100', 18);
    const previewDeposit = await vaultViewer.previewDeposit.staticCall(vault, assets);
    console.log(`previewDeposit from vaultViewer ${formatUnits(previewDeposit, 18)}`);
    console.log(`previewDeposit from vault ${formatUnits(await vault.previewDeposit(assets), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.previewDeposit(assets)).to.be.eq(previewDeposit);
  });

  it('previewMint', async () => {
    const shares = parseUnits('100', 18);
    const previewMint = await vaultViewer.previewMint.staticCall(vault, shares);
    console.log(`previewMint from vaultViewer ${formatUnits(previewMint, 18)}`);
    console.log(`previewMint from vault ${formatUnits(await vault.previewMint(shares), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.previewMint(shares)).to.be.eq(previewMint);
  });

  it('previewRedeem', async () => {
    const shares = parseUnits('100', 18);
    const previewRedeem = await vaultViewer.previewRedeem.staticCall(vault, shares);
    console.log(`previewRedeem from vaultViewer ${formatUnits(previewRedeem, 18)}`);
    console.log(`previewRedeem from vault ${formatUnits(await vault.previewRedeem(shares), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.previewRedeem(shares)).to.be.eq(previewRedeem);
  });

  it('convertToAssets', async () => {
    const assets = await vaultViewer.convertToAssets.staticCall(vault, parseUnits('100', 18));
    console.log(`assets from vaultViewer ${formatUnits(assets, 18)}`);
    console.log(`assets from vault ${formatUnits(await vault.convertToAssets(parseUnits('100', 18)), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.convertToAssets(parseUnits('100', 18))).to.be.eq(assets);
  });

  it('convertToShares', async () => {
    const shares = await vaultViewer.convertToShares.staticCall(vault, parseUnits('100', 18));
    console.log(`shares from vaultViewer ${formatUnits(shares, 18)}`);
    console.log(`shares from vault ${formatUnits(await vault.convertToShares(parseUnits('100', 18)), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.convertToShares(parseUnits('100', 18))).to.be.eq(shares);
  });

  it('totalAssets', async () => {
    const totalAssets = await vaultViewer.totalAssets.staticCall(vault);
    console.log(`totalAssets from vaultViewer ${formatUnits(totalAssets, 18)}`);
    console.log(`totalAssets from vault ${formatUnits(await vault.totalAssets(), 18)}`);

    await vault.connect(user1).updateTotalLent();
    expect(await vault.totalAssets()).to.be.eq(totalAssets);
  });
});
