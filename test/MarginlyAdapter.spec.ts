import { ethers, formatUnits, parseUnits, ZeroAddress } from 'ethers';
import { expect, use } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystem, deployTestSystemWithConfiguredVault } from './shared/fixtures';
import { ProtocolType } from './shared/utils';

describe('Marginly', () => {
  describe('Config manager', async () => {
    it('add marginly pool', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).addMarginlyPool(vault, marginlyPools[0]))
        .to.emit(configManager, 'MarginlyPoolAdded')
        .withArgs(vault, marginlyPools[0]);
    });

    it('add marginly pool should fail when unknown pool', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).addMarginlyPool(vault, vault)).to.be.reverted;
    });

    it('add marginly pool should fail when wrong pool', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).addMarginlyPool(vault, marginlyPools[8])).to.be.reverted;
    });

    it('add marginly pool should fail when pool argument is zero address', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
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
      const { vault, configManager, owner, user1, marginlyPools } = await loadFixture(deployTestSystem);
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
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).removeMarginlyPool(vault, 0)).to.be.revertedWithCustomError(
        configManager,
        'UnknownPool'
      );
    });

    it('remove marginly pool at zero index', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      expect(await configManager.getPoolByIndex(vault, 0)).to.be.eq(marginlyPools[0]);
      expect(await configManager.getPoolByIndex(vault, 1)).to.be.eq(marginlyPools[1]);
      expect(await configManager.getPoolByIndex(vault, 2)).to.be.eq(marginlyPools[2]);
      expect(await configManager.getPoolByIndex(vault, 3)).to.be.eq(marginlyPools[3]);
      expect(await configManager.getPoolByIndex(vault, 4)).to.be.eq(marginlyPools[4]);
      expect(await configManager.getPoolByIndex(vault, 5)).to.be.eq(marginlyPools[5]);
      expect(await configManager.getPoolByIndex(vault, 6)).to.be.eq(marginlyPools[6]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(7);

      await expect(configManager.removeMarginlyPool(vault, 0))
        .to.emit(configManager, 'MarginlyPoolRemoved')
        .withArgs(vault, marginlyPools[0]);

      expect(await configManager.getPoolByIndex(vault, 0)).to.be.eq(marginlyPools[6]);
      expect(await configManager.getPoolByIndex(vault, 1)).to.be.eq(marginlyPools[1]);
      expect(await configManager.getPoolByIndex(vault, 2)).to.be.eq(marginlyPools[2]);
      expect(await configManager.getPoolByIndex(vault, 3)).to.be.eq(marginlyPools[3]);
      expect(await configManager.getPoolByIndex(vault, 4)).to.be.eq(marginlyPools[4]);
      expect(await configManager.getPoolByIndex(vault, 5)).to.be.eq(marginlyPools[5]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(6);
    });

    it('remove marginly pool at last index', async () => {
      const { vault, configManager, owner, marginlyPools } = await loadFixture(deployTestSystemWithConfiguredVault);

      expect(await configManager.getPoolByIndex(vault, 0)).to.be.eq(marginlyPools[0]);
      expect(await configManager.getPoolByIndex(vault, 1)).to.be.eq(marginlyPools[1]);
      expect(await configManager.getPoolByIndex(vault, 2)).to.be.eq(marginlyPools[2]);
      expect(await configManager.getPoolByIndex(vault, 3)).to.be.eq(marginlyPools[3]);
      expect(await configManager.getPoolByIndex(vault, 4)).to.be.eq(marginlyPools[4]);
      expect(await configManager.getPoolByIndex(vault, 5)).to.be.eq(marginlyPools[5]);
      expect(await configManager.getPoolByIndex(vault, 6)).to.be.eq(marginlyPools[6]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(7);

      await configManager.removeMarginlyPool(vault, 6);

      expect(await configManager.getPoolByIndex(vault, 0)).to.be.eq(marginlyPools[0]);
      expect(await configManager.getPoolByIndex(vault, 1)).to.be.eq(marginlyPools[1]);
      expect(await configManager.getPoolByIndex(vault, 2)).to.be.eq(marginlyPools[2]);
      expect(await configManager.getPoolByIndex(vault, 3)).to.be.eq(marginlyPools[3]);
      expect(await configManager.getPoolByIndex(vault, 4)).to.be.eq(marginlyPools[4]);
      expect(await configManager.getPoolByIndex(vault, 5)).to.be.eq(marginlyPools[5]);
      expect(await configManager.getCountOfPools(vault)).to.be.eq(6);
    });

    it('remove marginly pool should fail when vault has positions', async () => {
      const { vault, usdc, user1, user2, configManager, owner, marginlyPools } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );
      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const supplyAmount = parseUnits('100', 18);
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), supplyAmount]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData);

      await expect(configManager.removeMarginlyPool(vault, 0)).to.be.revertedWithCustomError(
        configManager,
        'VaultHasPositionInPool'
      );
    });

    it('remove marginly pool should fail when sender is not an owner', async () => {
      const { vault, configManager, owner, user1 } = await loadFixture(deployTestSystemWithConfiguredVault);
      await expect(configManager.connect(user1).removeMarginlyPool(vault, 0)).to.be.revertedWithCustomError(
        configManager,
        'OwnableUnauthorizedAccount'
      );
    });
  });

  describe('MarginlyAdapter functions', async () => {
    it('seed', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), seedAmount0]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData);

      const seedAmount1 = parseUnits('10', 18);
      const seedData1 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[1].getAddress(), seedAmount1]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData1);

      const seedAmount3 = parseUnits('10', 18);
      const seedData3 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[2].getAddress(), seedAmount3]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData3);

      const seedAmount4 = parseUnits('10', 18);
      const seedData4 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[2].getAddress(), seedAmount4]
      );
      await vault.connect(user1).seed(0, seedData4);
    });

    it('seed should fail when pool not found', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const seedData0 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[7].getAddress(), seedAmount0]
      );
      await expect(vault.connect(user1).seed(ProtocolType.Marginly, seedData0)).to.be.revertedWithCustomError(
        marginlyAdapter,
        'UnknownPool'
      );
    });

    it('harvest', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const seedData0 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), seedAmount0]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData0);
    });

    it('harvest should fail when pool not found', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const seedData0 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await user2.address, seedAmount0]
      );
      await expect(vault.connect(user1).harvest(ProtocolType.Marginly, seedData0)).to.be.revertedWithCustomError(
        marginlyAdapter,
        'UnknownPool'
      );
    });

    it('update total lent', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const seedData0 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[0].getAddress(), seedAmount0]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData0);

      const seedAmount1 = parseUnits('10', 18);
      const seedData1 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[1].getAddress(), seedAmount1]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData1);

      const seedAmount3 = parseUnits('10', 18);
      const seedData3 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[2].getAddress(), seedAmount3]
      );
      await vault.connect(user1).seed(0, seedData3);

      const seedAmount4 = parseUnits('10', 18);
      const seedData4 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [await marginlyPools[2].getAddress(), seedAmount4]
      );
      await vault.connect(user1).seed(ProtocolType.Marginly, seedData4);

      await vault.connect(user1).updateTotalLent();
    });

    it('getLent amount, underlying asset as quoteToken in marginly pool', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const marginlyPoolAddress = await marginlyPools[0].getAddress();
      const seedData0 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [marginlyPoolAddress, seedAmount0]
      );
      await vault.connect(user1).updateTotalLent();

      await vault.connect(user1).seed(ProtocolType.Marginly, seedData0);
      const lentAmount = await marginlyAdapter.getLentAmount(vault);
      expect(lentAmount).to.be.eq(seedAmount0);
    });

    it('getLent amount, underlying asset as baseToken in marginly pool', async () => {
      const { vault, owner, usdc, user1, user2, configManager, marginlyAdapter, aaveAdapter, marginlyPools } =
        await loadFixture(deployTestSystemWithConfiguredVault);

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount0 = parseUnits('10', 18);
      const marginlyPoolAddress = await marginlyPools[1].getAddress();
      const seedData0 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [marginlyPoolAddress, seedAmount0]
      );
      await vault.connect(user1).updateTotalLent();

      await vault.connect(user1).seed(ProtocolType.Marginly, seedData0);
      const lentAmount = await marginlyAdapter.getLentAmount(vault);
      expect(lentAmount).to.be.eq(seedAmount0);
    });
  });
});
