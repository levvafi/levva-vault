import { ethers, formatUnits, parseUnits, ZeroAddress } from 'ethers';
import { upgrades } from 'hardhat';
import { expect, use } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystem, deployTestSystemWithConfiguredVault } from './shared/fixtures';
import { EtherfiWithdrawType, ProtocolType } from './shared/utils';
import { Vault__factory } from '../typechain-types';

describe('Vault', () => {
  describe('ERC4626', () => {
    it('depost', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const depositAmount = parseUnits('100', 18);
      await vault.updateTotalLent();
      const mintAmount = await vault.previewDeposit(depositAmount);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);

      const [depositEvent] = await vault.queryFilter(vault.filters.Deposit, -1);
      expect(depositEvent.args[0]).to.be.eq(user1.address); //sender
      expect(depositEvent.args[1]).to.be.eq(user1.address); //owner
      expect(depositEvent.args[2]).to.be.eq(depositAmount); //assets
      expect(depositEvent.args[3]).to.be.eq(mintAmount); //shares
    });

    it('deposit and send lp to another account', async () => {
      const { vault, usdc, user1, user2 } = await loadFixture(deployTestSystem);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user2);

      const depositAmount = parseUnits('100', 18);
      await vault.updateTotalLent();
      const mintAmount = await vault.previewDeposit(depositAmount);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user2);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user2)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);

      const [depositEvent] = await vault.queryFilter(vault.filters.Deposit, -1);
      expect(depositEvent.args[0]).to.be.eq(user1.address); //sender
      expect(depositEvent.args[1]).to.be.eq(user2.address); //owner
      expect(depositEvent.args[2]).to.be.eq(depositAmount); //assets
      expect(depositEvent.args[3]).to.be.eq(mintAmount); //shares
    });

    it('mint', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const mintAmount = parseUnits('100', 18);
      await vault.updateTotalLent();
      const depositAmount = await vault.previewDeposit(mintAmount);
      await usdc.connect(user1).approve(vault, mintAmount);
      await vault.connect(user1).mint(mintAmount, user1);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);

      const [depositEvent] = await vault.queryFilter(vault.filters.Deposit, -1);
      expect(depositEvent.args[0]).to.be.eq(user1.address); //sender
      expect(depositEvent.args[1]).to.be.eq(user1.address); //owner
      expect(depositEvent.args[2]).to.be.eq(depositAmount); //assets
      expect(depositEvent.args[3]).to.be.eq(mintAmount); //shares
    });

    it('mint to another address', async () => {
      const { vault, usdc, user1, user2 } = await loadFixture(deployTestSystem);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user2);

      const mintAmount = parseUnits('100', 18);
      await vault.updateTotalLent();
      const depositAmount = await vault.previewDeposit(mintAmount);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).mint(mintAmount, user2);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user2)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);

      const [depositEvent] = await vault.queryFilter(vault.filters.Deposit, -1);
      expect(depositEvent.args[0]).to.be.eq(user1.address); //sender
      expect(depositEvent.args[1]).to.be.eq(user2.address); //owner
      expect(depositEvent.args[2]).to.be.eq(depositAmount); //assets
      expect(depositEvent.args[3]).to.be.eq(mintAmount); //shares
    });

    it('withdraw', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const withdrawAmount = depositAmount;
      await vault.updateTotalLent();
      const redeemAmount = await vault.previewRedeem(withdrawAmount);
      await vault.connect(user1).withdraw(withdrawAmount, user1, user1);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);

      const [withdrawEvent] = await vault.queryFilter(vault.filters.Withdraw, -1);
      expect(withdrawEvent.args[0]).to.be.eq(user1.address); // sender
      expect(withdrawEvent.args[1]).to.be.eq(user1.address); // receiver
      expect(withdrawEvent.args[2]).to.be.eq(user1.address); // owner
      expect(withdrawEvent.args[3]).to.be.eq(withdrawAmount); // assets
      expect(withdrawEvent.args[4]).to.be.eq(redeemAmount); // shares
    });

    it('withdraw to another account', async () => {
      const { vault, usdc, user1, user2 } = await loadFixture(deployTestSystem);
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      const userBalanceBefore = await usdc.balanceOf(user2);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const withdrawAmount = depositAmount;
      await vault.updateTotalLent();
      const redeemAmount = await vault.previewRedeem(withdrawAmount);
      await vault.connect(user1).withdraw(withdrawAmount, user2, user1);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);

      const [withdrawEvent] = await vault.queryFilter(vault.filters.Withdraw, -1);
      expect(withdrawEvent.args[0]).to.be.eq(user1.address); // sender
      expect(withdrawEvent.args[1]).to.be.eq(user2.address); // receiver
      expect(withdrawEvent.args[2]).to.be.eq(user1.address); // owner
      expect(withdrawEvent.args[3]).to.be.eq(withdrawAmount); // assets
      expect(withdrawEvent.args[4]).to.be.eq(redeemAmount); // shares
    });

    it('withdraw, sender, owner and receiver are different', async () => {
      const { vault, usdc, user1, user2, user3 } = await loadFixture(deployTestSystem);
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      const userBalanceBefore = await usdc.balanceOf(user2);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const withdrawAmount = depositAmount;
      await vault.updateTotalLent();
      const redeemAmount = await vault.previewRedeem(withdrawAmount);
      await vault.connect(user1).approve(user3, withdrawAmount);
      expect(await vault.allowance(user1, user3)).to.be.eq(withdrawAmount);

      await vault.connect(user3).withdraw(withdrawAmount, user2, user1);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);

      const [withdrawEvent] = await vault.queryFilter(vault.filters.Withdraw, -1);
      expect(withdrawEvent.args[0]).to.be.eq(user3.address); // sender
      expect(withdrawEvent.args[1]).to.be.eq(user2.address); // receiver
      expect(withdrawEvent.args[2]).to.be.eq(user1.address); // owner
      expect(withdrawEvent.args[3]).to.be.eq(withdrawAmount); // assets
      expect(withdrawEvent.args[4]).to.be.eq(redeemAmount); // shares
    });

    it('withdraw should fail when exceeds maxWithdraw', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);
      const withdrawAmount = parseUnits('100', 18);

      await expect(vault.connect(user1).withdraw(withdrawAmount, user1, user1)).to.be.revertedWithCustomError(
        vault,
        'ERC4626ExceededMaxWithdraw'
      );
    });

    it('redeem', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const redeemAmount = depositAmount;
      await vault.connect(user1).redeem(redeemAmount, user1, user1);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore + redeemAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - redeemAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - redeemAmount);

      const [withdrawEvent] = await vault.queryFilter(vault.filters.Withdraw, -1);
      expect(withdrawEvent.args[0]).to.be.eq(user1.address); // sender
      expect(withdrawEvent.args[1]).to.be.eq(user1.address); // receiver
      expect(withdrawEvent.args[2]).to.be.eq(user1.address); // owner
      expect(withdrawEvent.args[3]).to.be.eq(redeemAmount); // assets
      expect(withdrawEvent.args[4]).to.be.eq(redeemAmount); // shares
    });

    it('redeem to another account', async () => {
      const { vault, usdc, user1, user2 } = await loadFixture(deployTestSystem);
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      const userBalanceBefore = await usdc.balanceOf(user2);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const redeemAmount = depositAmount;
      await vault.updateTotalLent();
      const withdrawAmount = await vault.previewRedeem(redeemAmount);
      await vault.connect(user1).redeem(redeemAmount, user2, user1);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);

      const [withdrawEvent] = await vault.queryFilter(vault.filters.Withdraw, -1);
      expect(withdrawEvent.args[0]).to.be.eq(user1.address); // sender
      expect(withdrawEvent.args[1]).to.be.eq(user2.address); // receiver
      expect(withdrawEvent.args[2]).to.be.eq(user1.address); // owner
      expect(withdrawEvent.args[3]).to.be.eq(withdrawAmount); // assets
      expect(withdrawEvent.args[4]).to.be.eq(redeemAmount); // shares
    });

    it('redeem, sender owner and receiver are different', async () => {
      const { vault, usdc, user1, user2, user3 } = await loadFixture(deployTestSystem);
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      const userBalanceBefore = await usdc.balanceOf(user2);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const redeemAmount = depositAmount;
      await vault.updateTotalLent();
      const withdrawAmount = await vault.previewRedeem(redeemAmount);
      await vault.connect(user1).approve(user3, redeemAmount);
      expect(await vault.allowance(user1, user3)).to.be.eq(redeemAmount);

      await vault.connect(user3).withdraw(redeemAmount, user2, user1);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);

      const [withdrawEvent] = await vault.queryFilter(vault.filters.Withdraw, -1);
      expect(withdrawEvent.args[0]).to.be.eq(user3.address); // sender
      expect(withdrawEvent.args[1]).to.be.eq(user2.address); // receiver
      expect(withdrawEvent.args[2]).to.be.eq(user1.address); // owner
      expect(withdrawEvent.args[3]).to.be.eq(withdrawAmount); // assets
      expect(withdrawEvent.args[4]).to.be.eq(redeemAmount); // shares
    });

    it('redeem should fail when exceeds maxRedeem', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);
      const redeemAmount = parseUnits('100', 18);

      await expect(vault.connect(user1).redeem(redeemAmount, user1, user1)).to.be.revertedWithCustomError(
        vault,
        'ERC4626ExceededMaxRedeem'
      );
    });

    it('lp price should increase after rewards', async () => {
      const { vault, usdc, user1, user2, user3 } = await loadFixture(deployTestSystem);
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      let lpPrice = await vault.convertToShares(parseUnits('1', 18));
      //console.log(`initial lp price ${formatUnits(ethPerLp, 18)} eth`);
      expect(lpPrice).to.be.eq(parseUnits('1', 18));

      await usdc.connect(user1).transfer(vault, parseUnits('100', 18));

      lpPrice = await vault.convertToShares(parseUnits('1', 18));
      //console.log(`new lp price ${formatUnits(newEthPerLp, 18)} eth`);
      expect(lpPrice).to.be.eq(parseUnits('0.5', 18));
    });

    it('dry vault after rewards', async () => {
      const { vault, usdc, user1, user2, user3, connectedMarginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1);

      // simulate rewards
      await usdc.connect(user1).transfer(vault, parseUnits('50', 18));

      // simulate small amount in lending protocol
      const position = {
        _type: 1,
        heapPosition: 0,

        discountedBaseAmount: 1,
        discountedQuoteAmount: 1,
      };
      await connectedMarginlyPools[0].setPosition(vault, position);

      console.log(`lent Amount in vault ${await vault.connect(user1).getLentAmount(0)}`);
      await vault.connect(user1).updateTotalLent();
      expect(await vault.connect(user1).getLentAmount(0)).to.be.eq(1);

      // redeem all lp tokens
      await vault.connect(user1).redeem(await vault.balanceOf(user1), user1, user1);
      expect(await vault.totalSupply()).to.be.eq(0);

      let lpPrice = await vault.convertToShares(parseUnits('1', 18));
      console.log(`initial lp price ${formatUnits(lpPrice, 18)} eth`);
      //expect(lpPrice).to.be.eq(parseUnits('1', 18));
    });

    it('vault with technical position, dry', async () => {
      const { vault, usdc, user1, user2, user3, connectedMarginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      //  initialize pool with technical position deposit on $5
      const techPositionDeposit = parseUnits('5', 18);
      await usdc.connect(user1).approve(vault, techPositionDeposit);
      await vault.connect(user1).deposit(techPositionDeposit, user1);

      // user 1 deposit 100 usdc
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user1);

      let lpPrice = await vault.convertToAssets(parseUnits('1', 18));
      console.log(`lpPrice ${formatUnits(lpPrice, 18)}`);

      //simulate profit
      await usdc.connect(user1).transfer(vault, parseUnits('50', 18));
      await vault.connect(user1).updateTotalLent();

      // simulate small amount in lending protocol
      const position = {
        _type: 1,
        heapPosition: 0,

        discountedBaseAmount: 1,
        discountedQuoteAmount: 1,
      };
      await connectedMarginlyPools[0].setPosition(vault, position);

      lpPrice = await vault.convertToAssets(parseUnits('1', 18));
      console.log(`lpPrice ${formatUnits(lpPrice, 18)}`);

      // redeem all lp tokens
      await vault.connect(user2).redeem(await vault.balanceOf(user2), user2, user2);

      lpPrice = await vault.convertToAssets(parseUnits('1', 18));
      console.log(`lpPrice ${formatUnits(lpPrice, 18)}`);
    });
  });

  describe('Vault management', () => {
    it('get config manager', async () => {
      const { vault, owner, configManager } = await loadFixture(deployTestSystem);
      expect(await vault.getConfigManager()).to.be.eq(await configManager.getAddress());
    });

    it('seed should fail when adapter is not set', async () => {
      const { vault, owner } = await loadFixture(deployTestSystem);
      await vault.connect(owner).addVaultManager(owner, true);
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1000]);
      await expect(vault.connect(owner).seed(ProtocolType.Etherfi, seedData)).to.be.revertedWithCustomError(
        vault,
        'AdapterIsNotSet'
      );
    });

    it('add adapter', async () => {
      const { vault, owner, marginlyAdapter, aaveAdapter } = await loadFixture(deployTestSystem);

      expect(await vault.getLendingAdapter(0)).to.be.eq(ZeroAddress);
      expect(await vault.getLendingAdapter(1)).to.be.eq(ZeroAddress);
      expect(await vault.getLendingAdapter(2)).to.be.eq(ZeroAddress);

      await vault.connect(owner).addLendingAdapter(0, marginlyAdapter);
      expect(await vault.getLendingAdapter(0)).to.be.eq(await marginlyAdapter.getAddress());

      await vault.connect(owner).addLendingAdapter(1, aaveAdapter);
      expect(await vault.getLendingAdapter(1)).to.be.eq(await aaveAdapter.getAddress());
    });

    it('add adapter should fail when sender is not an owner', async () => {
      const { vault, user1, marginlyAdapter, aaveAdapter } = await loadFixture(deployTestSystem);
      await expect(vault.connect(user1).addLendingAdapter(0, marginlyAdapter)).to.be.revertedWithCustomError(
        vault,
        'OwnableUnauthorizedAccount'
      );
    });

    it('add vault manager', async () => {
      const { vault, owner, user1, marginlyAdapter, aaveAdapter } = await loadFixture(deployTestSystem);

      await vault.connect(owner).addVaultManager(user1.address, true);
      await vault.connect(owner).addVaultManager(user1.address, false);
    });

    it('add vault manager should fail when sender is not an owner', async () => {
      const { vault, owner, user1, marginlyAdapter, aaveAdapter } = await loadFixture(deployTestSystem);

      await expect(vault.connect(user1).addVaultManager(user1.address, true)).to.be.revertedWithCustomError(
        vault,
        'OwnableUnauthorizedAccount'
      );
    });
  });

  describe('Vault managers functions', () => {
    it('seed', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), supplyAmount]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, data);

      await vault.connect(user1).updateTotalLent();
      expect(await vault.getTotalLent()).to.be.eq(supplyAmount);
      expect(await vault.getFreeAmount()).to.be.eq(0);
    });

    it('seed should fail when sender is not a vault manager', async () => {
      const { vault, usdc, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), supplyAmount]
      );

      await expect(vault.connect(user2).seed(ProtocolType.Marginly, data)).to.be.revertedWithCustomError(
        vault,
        'SenderIsNotVaultManager'
      );
    });

    it('harvest', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);

      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), supplyAmount]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData);

      const harvestAmount = parseUnits('100', 18);
      const harvestData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), harvestAmount]
      );
      await vault.connect(user1).harvest(ProtocolType.Marginly, harvestData);

      expect(await vault.getTotalLent()).to.be.eq(0);
      expect(await vault.getFreeAmount()).to.be.eq(depositAmount);
    });

    it('harvest should fail when sender is not a vault manager', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), supplyAmount]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData);

      const harvestAmount = parseUnits('100', 18);
      const harvestData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), harvestAmount]
      );

      await expect(vault.connect(user2).harvest(ProtocolType.Marginly, harvestData)).to.be.revertedWithCustomError(
        vault,
        'SenderIsNotVaultManager'
      );
    });
  });

  describe('Vault upgrade', async () => {
    it('upgrade should fail when authorized', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      await expect(
        upgrades.upgradeProxy(vault, new Vault__factory().connect(user1), {
          unsafeAllow: ['delegatecall'],
        })
      ).to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
    });

    it('upgrade by owner', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      await upgrades.upgradeProxy(vault, new Vault__factory().connect(owner), {
        unsafeAllow: ['delegatecall'],
      });
    });
  });
});
