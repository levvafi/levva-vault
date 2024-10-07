import { ethers, formatEther, parseUnits, ZeroAddress } from 'ethers';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystem, deployTestSystemWithConfiguredVault } from './shared/fixtures';
import { encodeMarginlyDeposit, encodeMarginlyWithdraw, ProtocolType } from './shared/utils';

describe('Marginly', () => {
  describe('Config manager', async () => {
    it('add marginly pool', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).addMarginlyPool(vault, marginlyPools[0]))
        .to.emit(configManager, 'MarginlyPoolAdded')
        .withArgs(vault, marginlyPools[0]);
    });

    it('add marginly pool should fail when unknown pool', async () => {
      const { vault, configManager, owner } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).addMarginlyPool(vault, vault)).to.be.reverted;
    });

    it('add marginly pool should fail when wrong pool', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).addMarginlyPool(vault, marginlyPools[8])).to.be.reverted;
    });

    it('add marginly pool should fail when pool argument is zero address', async () => {
      const { vault, configManager, owner } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).addMarginlyPool(vault, ZeroAddress)).to.be.revertedWithCustomError(
        configManager,
        'ZeroAddress'
      );
    });

    it('add marginly pool should fail when pool limit reached', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);
      await expect(configManager.connect(owner).addMarginlyPool(vault, marginlyPools[7])).to.be.revertedWithCustomError(
        configManager,
        'PoolsLimitReached'
      );
    });

    it('add maringly pool should fail when sender is not an owner', async () => {
      const { vault, configManager, user1, marginlyPools } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(user1).addMarginlyPool(vault, marginlyPools[0])).to.be.revertedWithCustomError(
        configManager,
        'OwnableUnauthorizedAccount'
      );
    });

    it('add marginly pool should failt when pool already added', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
      await configManager.connect(owner).addMarginlyPool(vault, marginlyPools[0]);
      await expect(configManager.connect(owner).addMarginlyPool(vault, marginlyPools[0])).to.be.revertedWithCustomError(
        configManager,
        'PoolAlreadyAdded'
      );
    });

    it('remove marginly pool should fail when pool not connected to vault', async () => {
      const { vault, configManager, owner } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).removeMarginlyPool(vault, 0)).to.be.revertedWithCustomError(
        configManager,
        'UnknownPool'
      );
    });

    it('remove marginly pool at zero index', async () => {
      const { vault, configManager, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      expect((await configManager.getPoolConfigByIndex(vault, 0)).pool).to.be.eq(marginlyPools[0]);
      expect((await configManager.getPoolConfigByIndex(vault, 1)).pool).to.be.eq(marginlyPools[1]);
      expect((await configManager.getPoolConfigByIndex(vault, 2)).pool).to.be.eq(marginlyPools[2]);
      expect((await configManager.getPoolConfigByIndex(vault, 3)).pool).to.be.eq(marginlyPools[3]);
      expect((await configManager.getPoolConfigByIndex(vault, 4)).pool).to.be.eq(marginlyPools[4]);
      expect((await configManager.getPoolConfigByIndex(vault, 5)).pool).to.be.eq(marginlyPools[5]);
      expect((await configManager.getPoolConfigByIndex(vault, 6)).pool).to.be.eq(marginlyPools[6]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(7);

      await expect(configManager.removeMarginlyPool(vault, 0))
        .to.emit(configManager, 'MarginlyPoolRemoved')
        .withArgs(vault, marginlyPools[0]);

      expect((await configManager.getPoolConfigByIndex(vault, 0)).pool).to.be.eq(marginlyPools[6]);
      expect((await configManager.getPoolConfigByIndex(vault, 1)).pool).to.be.eq(marginlyPools[1]);
      expect((await configManager.getPoolConfigByIndex(vault, 2)).pool).to.be.eq(marginlyPools[2]);
      expect((await configManager.getPoolConfigByIndex(vault, 3)).pool).to.be.eq(marginlyPools[3]);
      expect((await configManager.getPoolConfigByIndex(vault, 4)).pool).to.be.eq(marginlyPools[4]);
      expect((await configManager.getPoolConfigByIndex(vault, 5)).pool).to.be.eq(marginlyPools[5]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(6);
    });

    it('remove marginly pool at last index', async () => {
      const { vault, configManager, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      expect((await configManager.getPoolConfigByIndex(vault, 0)).pool).to.be.eq(marginlyPools[0]);
      expect((await configManager.getPoolConfigByIndex(vault, 1)).pool).to.be.eq(marginlyPools[1]);
      expect((await configManager.getPoolConfigByIndex(vault, 2)).pool).to.be.eq(marginlyPools[2]);
      expect((await configManager.getPoolConfigByIndex(vault, 3)).pool).to.be.eq(marginlyPools[3]);
      expect((await configManager.getPoolConfigByIndex(vault, 4)).pool).to.be.eq(marginlyPools[4]);
      expect((await configManager.getPoolConfigByIndex(vault, 5)).pool).to.be.eq(marginlyPools[5]);
      expect((await configManager.getPoolConfigByIndex(vault, 6)).pool).to.be.eq(marginlyPools[6]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(7);

      await configManager.removeMarginlyPool(vault, 6);

      expect((await configManager.getPoolConfigByIndex(vault, 0)).pool).to.be.eq(marginlyPools[0]);
      expect((await configManager.getPoolConfigByIndex(vault, 1)).pool).to.be.eq(marginlyPools[1]);
      expect((await configManager.getPoolConfigByIndex(vault, 2)).pool).to.be.eq(marginlyPools[2]);
      expect((await configManager.getPoolConfigByIndex(vault, 3)).pool).to.be.eq(marginlyPools[3]);
      expect((await configManager.getPoolConfigByIndex(vault, 4)).pool).to.be.eq(marginlyPools[4]);
      expect((await configManager.getPoolConfigByIndex(vault, 5)).pool).to.be.eq(marginlyPools[5]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(6);
    });

    it('remove marginly pool should fail when vault has positions', async () => {
      const { vault, usdc, user1, user2, configManager, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), supplyAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      await expect(configManager.removeMarginlyPool(vault, 0)).to.be.revertedWithCustomError(
        configManager,
        'VaultHasPositionInPool'
      );
    });

    it('remove marginly pool should fail when sender is not an owner', async () => {
      const { vault, configManager, user1 } = await loadFixture(deployTestSystemWithConfiguredVault);
      await expect(configManager.connect(user1).removeMarginlyPool(vault, 0)).to.be.revertedWithCustomError(
        configManager,
        'OwnableUnauthorizedAccount'
      );
    });
  });

  describe('MarginlyAdapter functions', async () => {
    it('deposit', async () => {
      const { vault, usdc, user1, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const marginlyDepositAction0 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), seedAmount0),
      };
      const marginlyDepositAction1 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[1].getAddress(), seedAmount0),
      };
      const marginlyDepositAction2 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[2].getAddress(), seedAmount0),
      };
      const marginlyDepositAction3 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[3].getAddress(), seedAmount0),
      };

      await vault
        .connect(user1)
        .executeProtocolAction([
          marginlyDepositAction0,
          marginlyDepositAction1,
          marginlyDepositAction2,
          marginlyDepositAction3,
        ]);
    });

    it('deposit should fail when pool not found', async () => {
      const { vault, usdc, user1, user2, marginlyAdapter, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount = parseUnits('10', 18);
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[7].getAddress(), seedAmount),
      };
      await expect(vault.connect(user1).executeProtocolAction([marginlyDepositAction])).to.be.revertedWithCustomError(
        marginlyAdapter,
        'UnknownPool'
      );
    });

    it('withdraw', async () => {
      const { vault, usdc, user1, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount = parseUnits('10', 18);
      const marginlyPoolAddress = await marginlyPools[0].getAddress();
      const marginlyDepositAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPoolAddress, seedAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyDepositAction]);

      const harvestAmount = parseUnits('5', 18);
      const marginlyWithdrawAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(marginlyPoolAddress, harvestAmount),
      };
      await vault.connect(user1).executeProtocolAction([marginlyWithdrawAction]);
    });

    it('withdraw should fail when pool not found', async () => {
      const { vault, usdc, user1, user2, marginlyAdapter } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const harvestAmount = parseUnits('5', 18);
      const marginlyWithdrawAction = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyWithdraw(user2.address, harvestAmount),
      };
      await expect(vault.connect(user1).executeProtocolAction([marginlyWithdrawAction])).to.be.revertedWithCustomError(
        marginlyAdapter,
        'UnknownPool'
      );
    });

    it('update total lent', async () => {
      const { vault, usdc, user1, user2, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const marginlyDepositAction0 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), seedAmount0),
      };
      const marginlyDepositAction1 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[1].getAddress(), seedAmount0),
      };
      const marginlyDepositAction2 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[2].getAddress(), seedAmount0),
      };
      const marginlyDepositAction3 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[3].getAddress(), seedAmount0),
      };

      await vault
        .connect(user1)
        .executeProtocolAction([
          marginlyDepositAction0,
          marginlyDepositAction1,
          marginlyDepositAction2,
          marginlyDepositAction3,
        ]);

      expect(await vault.getTotalLent()).to.be.eq(seedAmount0 * 4n);
    });

    it('getLent amount, underlying asset as quoteToken in marginly pool', async () => {
      const { vault, usdc, user1, user2, marginlyAdapter, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const marginlyDepositAction0 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[0].getAddress(), seedAmount0),
      };

      await vault.connect(user1).executeProtocolAction([marginlyDepositAction0]);
      const lentAmount = await marginlyAdapter.getLentAmount(vault);
      expect(lentAmount).to.be.eq(seedAmount0);
    });

    it('getLent amount, underlying asset as baseToken in marginly pool', async () => {
      const { vault, usdc, user1, user2, marginlyAdapter, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const marginlyDepositAction0 = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(await marginlyPools[1].getAddress(), seedAmount0),
      };

      await vault.connect(user1).executeProtocolAction([marginlyDepositAction0]);
      const lentAmount = await marginlyAdapter.getLentAmount(vault);
      expect(lentAmount).to.be.eq(seedAmount0);
    });
  });
});
