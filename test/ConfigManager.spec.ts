import { ZeroAddress } from 'ethers';
import { expect, use } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystem } from './shared/fixtures';

describe('ConfigManager', () => {
  it('addVault', async () => {
    const { configManager, vault, owner } = await loadFixture(deployTestSystem);
    await configManager.connect(owner).addVault(vault, true);
  });

  it('addValut could remove vault', async () => {
    const { configManager, vault, owner } = await loadFixture(deployTestSystem);
    await configManager.connect(owner).addVault(vault, false);
  });

  it('addVault should fail when argument is zero address', async () => {
    const { configManager, owner } = await loadFixture(deployTestSystem);
    await expect(configManager.connect(owner).addVault(ZeroAddress, true)).to.be.revertedWithCustomError(
      configManager,
      'ZeroAddress'
    );
  });

  it('addVault should fail when sender is not owner', async () => {
    const { configManager, user2 } = await loadFixture(deployTestSystem);
    await expect(configManager.connect(user2).addVault(ZeroAddress, true)).to.be.revertedWithCustomError(
      configManager,
      'OwnableUnauthorizedAccount'
    );
  });
});
