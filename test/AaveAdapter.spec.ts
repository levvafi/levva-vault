import { Addressable, ethers, formatUnits, parseUnits, ZeroAddress } from 'ethers';
import { expect, use } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystem, deployTestSystemWithConfiguredVault } from './shared/fixtures';
import { ProtocolType } from './shared/utils';

describe('Aave', () => {
  describe('Config', async () => {
    it('set aave pool', async () => {
      const { vault, configManager, owner, aavePool } = await loadFixture(deployTestSystem);
      expect(await configManager.getAavePool()).to.be.eq(ZeroAddress);
      await configManager.connect(owner).setAavePool(aavePool);
      expect(await configManager.getAavePool()).to.be.eq(aavePool);
    });

    it('set aave pool should fail when address is zero', async () => {
      const { vault, configManager, owner, aavePool } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(owner).setAavePool(ZeroAddress)).to.be.revertedWithCustomError(
        configManager,
        'ZeroAddress'
      );
    });

    it('set aave pool should fail when sender is not an owner', async () => {
      const { vault, configManager, owner, user1, aavePool } = await loadFixture(deployTestSystem);
      await expect(configManager.connect(user1).setAavePool(aavePool)).to.be.revertedWithCustomError(
        configManager,
        'OwnableUnauthorizedAccount'
      );
    });
  });

  describe('AaveAdapter', async () => {
    it('seed', async () => {
      const { vault, user1, user2, usdc, configManager, owner, aavePool } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount = parseUnits('50', 18);
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Aave, seedData);
    });

    it('harvest', async () => {
      const { vault, user1, user2, usdc, configManager, owner, aavePool } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount = parseUnits('50', 18);
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Aave, seedData);

      const harvestAmount = parseUnits('50', 18);
      const harvestData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [harvestAmount]);
      await vault.connect(user1).harvest(ProtocolType.Aave, harvestData);
    });

    it('update', async () => {
      const { vault, user1, user2, usdc, configManager, owner, aavePool } = await loadFixture(
        deployTestSystemWithConfiguredVault
      );

      const depositAmount = parseUnits('100', 18);
      await usdc.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      await vault.connect(user1).updateTotalLent();
    });
  });
});
