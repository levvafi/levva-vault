import { formatUnits, parseEther, parseUnits, Typed, ZeroAddress } from 'ethers';
import { upgrades } from 'hardhat';
import { expect, expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystem, deployTestSystemWithConfiguredVault } from './shared/fixtures';
import {
  encodeEtherfiDeposit,
  encodeMarginlyDeposit,
  encodeMarginlyWithdraw,
  encodeResult,
  ProtocolType,
} from './shared/utils';
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
      const mintAmount = await vault.previewDeposit(depositAmount);
      await usdc.connect(user1).approve(vault, depositAmount);
      await expect(vault.connect(user1).deposit(depositAmount, user1))
        .to.emit(vault, 'Deposit')
        .withArgs(user1.address, user1.address, depositAmount, mintAmount);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);
    });

    it('deposit and send lp to another account', async () => {
      const { vault, usdc, user1, user2 } = await loadFixture(deployTestSystem);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user2);

      const depositAmount = parseUnits('100', 18);
      const mintAmount = await vault.previewDeposit(depositAmount);
      await usdc.connect(user1).approve(vault, depositAmount);
      await expect(vault.connect(user1).deposit(depositAmount, user2))
        .to.emit(vault, 'Deposit')
        .withArgs(user1.address, user2.address, depositAmount, mintAmount);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user2)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);
    });

    it('deposit should fail when less than min deposit', async () => {
      const { vault, owner, usdc, user1, user2 } = await loadFixture(deployTestSystem);

      const minDeposit = parseUnits('2', 18);
      await vault.connect(owner).setMinDeposit(minDeposit);
      expect(await vault.getMinDeposit()).to.be.eq(minDeposit);

      const depositAmount = parseUnits('1', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await expect(vault.connect(user1).deposit(depositAmount, user1)).to.be.revertedWithCustomError(
        vault,
        'LessThanMinDeposit'
      );
    });

    it('deposit should fail when zero shares calculated', async () => {
      const { vault, usdc, user1, user2: attacker } = await loadFixture(deployTestSystem);

      await usdc.connect(attacker).transfer(vault, parseUnits('1000', 18));

      const depositAmount = parseUnits('1', 18);
      await usdc.connect(user1).approve(vault, depositAmount);
      await expect(vault.connect(user1).deposit(depositAmount, user1)).to.be.revertedWithCustomError(
        vault,
        'ZeroShares'
      );
    });

    it('mint', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user1);

      const mintAmount = parseUnits('100', 18);
      const depositAmount = await vault.previewDeposit(mintAmount);
      await usdc.connect(user1).approve(vault, mintAmount);
      await expect(vault.connect(user1).mint(mintAmount, user1))
        .to.emit(vault, 'Deposit')
        .withArgs(user1.address, user1.address, depositAmount, mintAmount);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);
    });

    it('mint should fail when less than min deposit', async () => {
      const { vault, owner, usdc, user1, user2 } = await loadFixture(deployTestSystem);

      const minDeposit = parseUnits('2', 18);
      await vault.connect(owner).setMinDeposit(minDeposit);
      expect(await vault.getMinDeposit()).to.be.eq(minDeposit);

      const mintAmount = parseUnits('1', 18);
      await usdc.connect(user1).approve(vault, mintAmount);
      await expect(vault.connect(user1).mint(mintAmount, user1)).to.be.revertedWithCustomError(
        vault,
        'LessThanMinDeposit'
      );
    });

    it('mint to another address', async () => {
      const { vault, usdc, user1, user2 } = await loadFixture(deployTestSystem);

      const userBalanceBefore = await usdc.balanceOf(user1);
      const vaultBalanceBefore = await usdc.balanceOf(vault);
      const freeAmountBefore = await vault.getFreeAmount();
      const lpUserBalanceBefore = await vault.balanceOf(user2);

      const mintAmount = parseUnits('100', 18);
      const depositAmount = await vault.previewDeposit(mintAmount);
      await usdc.connect(user1).approve(vault, depositAmount);
      await expect(vault.connect(user1).mint(mintAmount, user2))
        .to.emit(vault, 'Deposit')
        .withArgs(user1.address, user2.address, depositAmount, mintAmount);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore - depositAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore + depositAmount);
      expect(await vault.balanceOf(user2)).to.be.eq(lpUserBalanceBefore + mintAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore + depositAmount);
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
      const redeemAmount = await vault.previewRedeem(withdrawAmount);
      await expect(vault.connect(user1).withdraw(withdrawAmount, user1, user1))
        .to.emit(vault, 'Withdraw')
        .withArgs(user1.address, user1.address, user1.address, withdrawAmount, redeemAmount);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);
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
      const redeemAmount = await vault.previewRedeem(withdrawAmount);
      await expect(vault.connect(user1).withdraw(withdrawAmount, user2, user1))
        .to.emit(vault, 'Withdraw')
        .withArgs(user1.address, user2.address, user1.address, withdrawAmount, redeemAmount);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);
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
      const redeemAmount = await vault.previewRedeem(withdrawAmount);
      await vault.connect(user1).approve(user3, withdrawAmount);
      expect(await vault.allowance(user1, user3)).to.be.eq(withdrawAmount);

      await expect(vault.connect(user3).withdraw(withdrawAmount, user2, user1))
        .to.emit(vault, 'Withdraw')
        .withArgs(user3.address, user2.address, user1.address, withdrawAmount, redeemAmount);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);
    });

    it('withdraw should fail when exceeds maxWithdraw', async () => {
      const { vault, user1 } = await loadFixture(deployTestSystem);
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
      await expect(vault.connect(user1).redeem(redeemAmount, user1, user1))
        .to.emit(vault, 'Withdraw')
        .withArgs(user1.address, user1.address, user1.address, redeemAmount, redeemAmount);

      expect(await usdc.balanceOf(user1)).to.be.eq(userBalanceBefore + redeemAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - redeemAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - redeemAmount);
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
      const withdrawAmount = await vault.previewRedeem(redeemAmount);
      await expect(vault.connect(user1).redeem(redeemAmount, user2, user1))
        .to.emit(vault, 'Withdraw')
        .withArgs(user1.address, user2.address, user1.address, withdrawAmount, redeemAmount);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);
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
      const withdrawAmount = await vault.previewRedeem(redeemAmount);
      await vault.connect(user1).approve(user3, redeemAmount);
      expect(await vault.allowance(user1, user3)).to.be.eq(redeemAmount);

      await expect(vault.connect(user3).withdraw(redeemAmount, user2, user1))
        .to.emit(vault, 'Withdraw')
        .withArgs(user3.address, user2.address, user1.address, withdrawAmount, redeemAmount);

      expect(await usdc.balanceOf(user2)).to.be.eq(userBalanceBefore + withdrawAmount);
      expect(await usdc.balanceOf(vault)).to.be.eq(vaultBalanceBefore - withdrawAmount);
      expect(await vault.balanceOf(user1)).to.be.eq(lpUserBalanceBefore - redeemAmount);
      expect(await vault.getFreeAmount()).to.be.eq(freeAmountBefore - withdrawAmount);
    });

    it('redeem should fail when exceeds maxRedeem', async () => {
      const { vault, user1 } = await loadFixture(deployTestSystem);
      const redeemAmount = parseUnits('100', 18);

      await expect(vault.connect(user1).redeem(redeemAmount, user1, user1)).to.be.revertedWithCustomError(
        vault,
        'ERC4626ExceededMaxRedeem'
      );
    });

    it('lp price should increase after rewards', async () => {
      const { vault, usdc, user1 } = await loadFixture(deployTestSystem);
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
      const { vault, usdc, user1, connectedMarginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);
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
      expect(await vault.connect(user1).getLentAmount(0)).to.be.eq(1);

      // redeem all lp tokens
      await vault.connect(user1).redeem(await vault.balanceOf(user1), user1, user1);
      expect(await vault.totalSupply()).to.be.eq(0);

      let lpPrice = await vault.convertToShares(parseUnits('1', 18));
      console.log(`initial lp price ${formatUnits(lpPrice, 18)} eth`);
      //expect(lpPrice).to.be.eq(parseUnits('1', 18));
    });

    it('vault with technical position, dry', async () => {
      const { vault, usdc, user1, user2, connectedMarginlyPools } = await loadFixture(
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
      const { vault, configManager } = await loadFixture(deployTestSystem);
      expect(await vault.getConfigManager()).to.be.eq(await configManager.getAddress());
    });

    it('seed should fail when adapter is not set', async () => {
      const { vault, owner } = await loadFixture(deployTestSystem);
      await vault.connect(owner).addVaultManager(owner, true);

      const etherfiDepositAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(1000n),
      };
      await expect(vault.connect(owner).executeProtocolAction([etherfiDepositAction])).to.be.revertedWithCustomError(
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

    it('add adapter should emit event', async () => {
      const { vault, owner, marginlyAdapter } = await loadFixture(deployTestSystem);

      await expect(vault.connect(owner).addLendingAdapter(0, marginlyAdapter))
        .to.emit(vault, 'AddLendingAdapter')
        .withArgs(0, marginlyAdapter);
    });

    it('add adapter should fail when sender is not an owner', async () => {
      const { vault, user1, marginlyAdapter } = await loadFixture(deployTestSystem);
      await expect(vault.connect(user1).addLendingAdapter(0, marginlyAdapter)).to.be.revertedWithCustomError(
        vault,
        'OwnableUnauthorizedAccount'
      );
    });

    it('add vault manager', async () => {
      const { vault, owner, user1 } = await loadFixture(deployTestSystem);

      await vault.connect(owner).addVaultManager(user1.address, true);
      await vault.connect(owner).addVaultManager(user1.address, false);
    });

    it('add vault manager should fail when sender is not an owner', async () => {
      const { vault, user1 } = await loadFixture(deployTestSystem);

      await expect(vault.connect(user1).addVaultManager(user1.address, true)).to.be.revertedWithCustomError(
        vault,
        'OwnableUnauthorizedAccount'
      );
    });

    it('set min deposit', async () => {
      const { vault, owner, user1 } = await loadFixture(deployTestSystem);

      const minDeposit = parseEther('0.001');
      await expect(vault.connect(owner).setMinDeposit(minDeposit)).to.emit(vault, 'MinDepositSet').withArgs(minDeposit);

      expect(await vault.getMinDeposit()).to.be.eq(minDeposit);
    });

    it('set min deposit should fail when sender is not an owner', async () => {
      const { vault, user1 } = await loadFixture(deployTestSystem);
      await expect(vault.connect(user1).setMinDeposit(1)).to.be.revertedWithCustomError(
        vault,
        'OwnableUnauthorizedAccount'
      );
    });
  });

  describe('Vault managers functions', () => {
    it('seed', async () => {
      const { vault, usdc, user1, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      const oldBlockTimestamp = (await user1.provider.getBlock('latest'))!.timestamp;

      const supplyAmount = parseUnits('100', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };
      await expect(vault.connect(user1).executeProtocolAction([marginlyDepositAction]))
        .to.emit(vault, 'ProtocolActionExecuted')
        .withArgs(ProtocolType.Marginly, marginlyDepositAction.data, encodeResult(supplyAmount));

      expect(await vault.getTotalLent()).to.be.eq(supplyAmount);
      expect(await vault.getFreeAmount()).to.be.eq(0);
    });

    it('executeProtocolAction should fail when sender is not a vault manager', async () => {
      const { vault, usdc, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const protocolDepositAmount = parseUnits('100', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), protocolDepositAmount),
      };

      await expect(vault.connect(user2).executeProtocolAction([marginlyDepositAction])).to.be.revertedWithCustomError(
        vault,
        'SenderIsNotVaultManager'
      );
    });

    it('executeProtocolAction, marginly withdraw', async () => {
      const { vault, usdc, user1, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);

      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      const withdrawAmount = parseUnits('100', 18);
      const marginlyWithdrawAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(await marginlyPools[0].getAddress(), withdrawAmount),
      };

      await expect(vault.connect(user1).executeProtocolAction([marginlyWithdrawAction]))
        .to.emit(vault, 'ProtocolActionExecuted')
        .withArgs(ProtocolType.Marginly, marginlyWithdrawAction.data, encodeResult(withdrawAmount));

      expect(await vault.getTotalLent()).to.be.eq(0);
      expect(await vault.getFreeAmount()).to.be.eq(depositAmount);
    });

    it('executeProtocolAction should fail when sender is not a vault manager', async () => {
      const { vault, usdc, user1, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };

      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      const withdrawAmount = parseUnits('100', 18);

      const marginlyWithdrawAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(await marginlyPools[0].getAddress(), withdrawAmount),
      };

      await expect(vault.connect(user2).executeProtocolAction([marginlyWithdrawAction])).to.be.revertedWithCustomError(
        vault,
        'SenderIsNotVaultManager'
      );
    });
  });

  describe('Vault upgrade', async () => {
    it('upgrade should fail when authorized', async () => {
      const { vault, user1 } = await loadFixture(deployTestSystemWithConfiguredVault);

      await expect(
        upgrades.upgradeProxy(vault, new Vault__factory().connect(user1), {
          unsafeAllow: ['delegatecall'],
        })
      ).to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
    });

    it('upgrade by owner', async () => {
      const { vault, owner } = await loadFixture(deployTestSystemWithConfiguredVault);

      await upgrades.upgradeProxy(vault, new Vault__factory().connect(owner), {
        unsafeAllow: ['delegatecall'],
      });
    });
  });

  describe('Withdraw queue', async () => {
    it('request withdraw should immediately withdraw when free amount is enough', async () => {
      const { vault, owner, user1, user2, usdc, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const sharesToWithdraw = parseUnits('50', 18);
      const previewRedeem = await vault.previewRedeem(sharesToWithdraw);
      const assetsBefore = await usdc.balanceOf(user2.address);
      const sharesBefore = await vault.balanceOf(user2.address);
      await expect(vault.connect(user2).requestWithdraw(sharesToWithdraw))
        .to.emit(vault, 'Withdraw')
        .withArgs(user2.address, user2.address, user2.address, previewRedeem, sharesToWithdraw);

      const assetsAfter = await usdc.balanceOf(user2.address);
      const sharesAfter = await vault.balanceOf(user2.address);
      expect(assetsAfter).to.be.eq(assetsBefore + previewRedeem);
      expect(sharesAfter).to.be.eq(sharesBefore - sharesToWithdraw);
    });

    it('request withdraw', async () => {
      const { vault, owner, user1, user2, usdc, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      const lpTokenAddress = await vault.getAddress();

      const supplyAmount = parseUnits('100', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      expect(await vault.balanceOf(user2.address)).to.be.eq(depositAmount);
      expect(await vault.balanceOf(lpTokenAddress)).to.be.eq(0);

      const sharesToWithdraw = parseUnits('50', 18);
      const requestId = 0;
      await expect(vault.connect(user2).requestWithdraw(sharesToWithdraw))
        .to.emit(vault, 'WithdrawRequested')
        .withArgs(requestId, user2.address, sharesToWithdraw);

      const withdrawRequest = await vault.getWithdrawRequest(requestId);
      expect(withdrawRequest.owner).to.be.eq(user2.address);
      expect(withdrawRequest.shares).to.be.eq(sharesToWithdraw);

      // 50 shares locked in vault address
      expect(await vault.balanceOf(user2.address)).to.be.eq(sharesToWithdraw);
      expect(await vault.balanceOf(lpTokenAddress)).to.be.eq(sharesToWithdraw);

      // another withdraw request
      const requestId2 = 1;
      const sharesToWithdraw2 = parseUnits('10', 18);

      await expect(vault.connect(user2).requestWithdraw(sharesToWithdraw2))
        .to.emit(vault, 'WithdrawRequested')
        .withArgs(requestId2, user2.address, sharesToWithdraw2);

      const withdrawRequest2 = await vault.getWithdrawRequest(requestId2);
      expect(withdrawRequest2.owner).to.be.eq(user2.address);
      expect(withdrawRequest2.shares).to.be.eq(sharesToWithdraw2);

      expect(await vault.balanceOf(user2.address)).to.be.eq(depositAmount - sharesToWithdraw - sharesToWithdraw2);
      expect(await vault.balanceOf(lpTokenAddress)).to.be.eq(sharesToWithdraw + sharesToWithdraw2);
    });

    it('finalize withdraw request should fail when not authorized', async () => {
      const { vault, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      await expect(vault.connect(user2).finalizeWithdrawRequest()).to.revertedWithCustomError(
        vault,
        'SenderIsNotVaultManager'
      );
    });

    it('finalize withdraw request should fail when not enough free amount', async () => {
      const { vault, user1, user2, usdc, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      const lpTokenAddress = await vault.getAddress();

      const supplyAmount = parseUnits('100', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      expect(await vault.balanceOf(user2.address)).to.be.eq(depositAmount);
      expect(await vault.balanceOf(lpTokenAddress)).to.be.eq(0);

      const sharesToWithdraw = parseUnits('50', 18);
      await vault.connect(user2).requestWithdraw(sharesToWithdraw);

      const withdrawAmount = parseUnits('10', 18);
      const marginlyWithdrawAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(await marginlyPools[0].getAddress(), withdrawAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyWithdrawAction]);

      await expect(vault.connect(user1).finalizeWithdrawRequest()).to.be.revertedWithCustomError(
        vault,
        'ERC20InsufficientBalance'
      );
    });

    it('finalize withdraw request should fail when no elemnts in queue', async () => {
      const { vault, user1 } = await loadFixture(deployTestSystemWithConfiguredVault);

      await expect(vault.connect(user1).finalizeWithdrawRequest()).to.revertedWithCustomError(
        vault,
        'NoElementWithIndex'
      );
    });

    it('finalize withdraw request', async () => {
      const { vault, user1, user2, usdc, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      const lpTokenAddress = await vault.getAddress();

      const supplyAmount = parseUnits('100', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      expect(await vault.balanceOf(user2.address)).to.be.eq(depositAmount);
      expect(await vault.balanceOf(lpTokenAddress)).to.be.eq(0);

      const requestId = 0;
      const sharesToWithdraw = parseUnits('50', 18);
      await vault.connect(user2).requestWithdraw(sharesToWithdraw);
      expect(await vault.balanceOf(vault)).to.eq(sharesToWithdraw);

      const withdrawAmount = parseUnits('50', 18);
      const marginlyWithdrawAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(await marginlyPools[0].getAddress(), withdrawAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyWithdrawAction]);
      const queueStartIndex = await vault.getWithdrawQueueStartIndex();
      const queueEndIndex = await vault.getWithdrawQueueEndIndex();

      await expect(vault.connect(user1).finalizeWithdrawRequest())
        .to.emit(vault, 'WithdrawFinalized')
        .withArgs(requestId, user2.address, sharesToWithdraw, withdrawAmount);

      expect(await vault.balanceOf(vault)).to.eq(0);
      expect(await vault.getWithdrawQueueStartIndex()).to.eq(queueStartIndex + 1n);
      expect(await vault.getWithdrawQueueStartIndex()).to.eq(queueEndIndex);
    });

    it('finalize multiple withdraw requests', async () => {
      const { vault, user1, user2, user3, usdc, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount1 = parseUnits('10', 18);
      await usdc.connect(user2).approve(vault, depositAmount1);
      await vault.connect(user2).deposit(depositAmount1, user2);

      const depositAmount2 = parseUnits('15', 18);
      await usdc.connect(user3).approve(vault, depositAmount2);
      await vault.connect(user3).deposit(depositAmount2, user3);

      const supplyAmount = parseUnits('23', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      const requestId1 = 0;
      const sharesToWithdraw1 = parseUnits('7', 18);
      await vault.connect(user2).requestWithdraw(sharesToWithdraw1);

      const requestId2 = 1;
      const sharesToWithdraw2 = parseUnits('9', 18);
      await vault.connect(user3).requestWithdraw(sharesToWithdraw2);

      const withdrawAmount = parseUnits('16', 18);
      const marginlyWithdrawAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(await marginlyPools[0].getAddress(), withdrawAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyWithdrawAction]);
      expect(await vault.getFreeAmount()).to.eq(parseUnits('18', 18));

      let usdcBalanceBefore = await usdc.balanceOf(user2);
      await expect(vault.connect(user1).finalizeWithdrawRequest())
        .to.emit(vault, 'WithdrawFinalized')
        .withArgs(requestId1, user2.address, sharesToWithdraw1, sharesToWithdraw1);
      expect(await usdc.balanceOf(user2)).to.eq(usdcBalanceBefore + sharesToWithdraw1);

      usdcBalanceBefore = await usdc.balanceOf(user3);
      await expect(vault.connect(user1).finalizeWithdrawRequest())
        .to.emit(vault, 'WithdrawFinalized')
        .withArgs(requestId2, user3.address, sharesToWithdraw2, sharesToWithdraw2);
      expect(await usdc.balanceOf(user3)).to.eq(usdcBalanceBefore + sharesToWithdraw2);

      await expect(vault.connect(user1).finalizeWithdrawRequest()).to.revertedWithCustomError(
        vault,
        'NoElementWithIndex'
      );
    });
  });

  describe('Slippage protection', async () => {
    it('deposit with slippage protection', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      const minShares = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      expect(await vault.balanceOf(user2)).to.eq(0);
      await vault.connect(user2).depositWithSlippage(depositAmount, user2, minShares);
      expect(await vault.balanceOf(user2)).to.gte(minShares);
    });

    it('deposit should fail when shares are less than minShares', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      const minShares = parseUnits('101', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await expect(
        vault.connect(user2).depositWithSlippage(depositAmount, user2, minShares)
      ).to.be.revertedWithCustomError(vault, 'DepositSlippageProtection');
    });

    it('mint with slippage protection', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const mintAmount = parseUnits('100', 18);
      const maxAssets = parseUnits('100', 18);
      const balanceBefore = await vault.balanceOf(user2);
      await usdc.connect(user2).approve(vault, await vault.previewMint(mintAmount));
      await vault.connect(user2).mintWithSlippage(mintAmount, user2, maxAssets);

      expect(await vault.balanceOf(user2)).to.gte(balanceBefore + maxAssets);
    });

    it('mint should fail when assets are more than maxAssets', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const mintAmount = parseUnits('100', 18);
      const maxAssets = parseUnits('99', 18);
      await usdc.connect(user2).approve(vault, await vault.previewMint(mintAmount));
      await expect(vault.connect(user2).mintWithSlippage(mintAmount, user2, maxAssets)).to.be.revertedWithCustomError(
        vault,
        'MintSlippageProtection'
      );
    });

    it('withdraw with slippage protection', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const withdrawAmount = parseUnits('50', 18);
      const maxShares = parseUnits('50', 18);
      const sharesBefore = await vault.balanceOf(user2);
      await vault.connect(user2).withdrawWithSlippage(withdrawAmount, user2, user2, maxShares);
      const sharesAfter = await vault.balanceOf(user2);
      const burnedShares = sharesBefore - sharesAfter;
      expect(burnedShares).to.lte(maxShares);
    });

    it('withdraw should fail when shares are more than maxShares', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const withdrawAmount = parseUnits('50', 18);
      const maxShares = parseUnits('49', 18);
      await expect(
        vault.connect(user2).withdrawWithSlippage(withdrawAmount, user2, user2, maxShares)
      ).to.be.revertedWithCustomError(vault, 'WithdrawSlippageProtection');
    });

    it('redeem with slippage protection', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const redeemAmount = parseUnits('50', 18);
      const minAssets = parseUnits('50', 18);
      const assetsBefore = await usdc.balanceOf(user2);
      await vault.connect(user2).redeemWithSlippage(redeemAmount, user2, user2, minAssets);
      const assetsAfter = await usdc.balanceOf(user2);
      const assetsReceived = assetsAfter - assetsBefore;
      expect(assetsReceived).to.gte(minAssets);
    });

    it('redeem should fail when assets are less than minAssets', async () => {
      const { vault, usdc, user2 } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const redeemAmount = parseUnits('50', 18);
      const minAssets = parseUnits('51', 18);
      await expect(
        vault.connect(user2).redeemWithSlippage(redeemAmount, user2, user2, minAssets)
      ).to.be.revertedWithCustomError(vault, 'RedeemSlippageProtection');
    });
  });
});
