import { Addressable, ethers, formatUnits, parseEther, parseUnits, ZeroAddress } from 'ethers';
import { expect, use } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystem, deployTestSystemWithConfiguredWethVault } from './shared/fixtures';
import { EtherfiWithdrawType, logVaultState, ProtocolType } from './shared/utils';

describe('Etherfi', () => {
  describe('Config', async () => {
    it('enqueue withdraw request', async () => {
      const { vault, user1, user2, weth, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      await configManager.addVault(user1, true);

      const requestId = 1;
      const withdrawAmount = parseEther('2');
      await configManager.connect(user1).enqueueUnstakeRequest(requestId, withdrawAmount);

      const firstRequestId = await configManager.peekUnstakeRequestId(user1);
      expect(firstRequestId).to.equal(requestId);
    });

    it('enqueue withdraw request should fail when not authorized', async () => {
      const { vault, user1, user2, weth, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const requestId = 1;
      const withdrawAmount = parseEther('2');
      await expect(
        configManager.connect(user2).enqueueUnstakeRequest(requestId, withdrawAmount)
      ).to.be.revertedWithCustomError(configManager, 'SenderIsNotVault');
    });

    it('dequeue withdraw request', async () => {
      const { vault, user1, user2, weth, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      await configManager.addVault(user1, true);

      const requestId = 1;
      const withdrawAmount = parseEther('2');
      await configManager.connect(user1).enqueueUnstakeRequest(requestId, withdrawAmount);

      const [withdrawRequestId] = await configManager.connect(user1).dequeueUnstakeRequest.staticCallResult();
      expect(withdrawRequestId).to.equal(requestId);

      await configManager.connect(user1).dequeueUnstakeRequest();

      expect(await configManager.connect(user1).peekUnstakeRequestId(user1)).to.equal(0);
    });

    it('dequeue withdraw request should fail when not authorized', async () => {
      const { vault, user1, user2, weth, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      await configManager.addVault(user1, true);

      const requestId = 1;
      const withdrawAmount = parseEther('2');
      await configManager.connect(user1).enqueueUnstakeRequest(requestId, withdrawAmount);

      await expect(configManager.connect(user2).dequeueUnstakeRequest()).to.be.revertedWithCustomError(
        configManager,
        'SenderIsNotVault'
      );
    });

    it('getWeth9', async () => {
      const { weth, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);
      expect(await configManager.getWeth9()).to.equal(await weth.getAddress());
    });

    it('getWeETH', async () => {
      const { etherFi, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      expect(await configManager.getWeETH()).to.equal(await etherFi.weETH.getAddress());
    });

    it('getPendingWithdrawals', async () => {
      const { user1, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      let pendingWithdrawals = await configManager.getPendingWithdrawals(user1);
      expect(pendingWithdrawals).to.equal(0);

      await configManager.addVault(user1, true);

      const requestId = 1;
      const withdrawAmount = parseEther('2');
      await configManager.connect(user1).enqueueUnstakeRequest(requestId, withdrawAmount);

      pendingWithdrawals = await configManager.getPendingWithdrawals(user1);
      expect(pendingWithdrawals).to.equal(withdrawAmount);

      await configManager.connect(user1).dequeueUnstakeRequest();

      pendingWithdrawals = await configManager.getPendingWithdrawals(user1);
      expect(pendingWithdrawals).to.equal(0);
    });
  });

  describe('Etherfi adapter', async () => {
    it('seed', async () => {
      const { vault, user1, user2, weth } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount = parseEther('3');
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Etherfi, seedData);
      await vault.connect(user1).updateTotalLent();
    });

    it('harvest', async () => {
      const { vault, user1, user2, weth, etherFi } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      await vault.connect(user1).updateTotalLent();

      const seedAmount = parseEther('3');
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Etherfi, seedData);

      // request withdraw
      const harvestAmount = parseEther('2');
      const harvestData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint8', 'uint256'],
        [EtherfiWithdrawType.RequestWithdraw, harvestAmount]
      );
      await vault.connect(user1).harvest(ProtocolType.Etherfi, harvestData);

      // etherfi finalize requests
      await etherFi.withdrawRequestNFT.setWithdrawalStatus(1, true, false, true);

      // claim withdraw
      const claimData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint8', 'uint256'],
        [EtherfiWithdrawType.ClaimWithdraw, 1]
      );
      await vault.connect(user1).harvest(ProtocolType.Etherfi, claimData);
    });

    it('harvest should fail when request not finalized', async () => {
      const { vault, user1, user2, weth, etherFi, etherfiAdapter } = await loadFixture(
        deployTestSystemWithConfiguredWethVault
      );

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      await vault.connect(user1).updateTotalLent();

      const seedAmount = parseEther('3');
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Etherfi, seedData);

      // request withdraw
      const harvestAmount = parseEther('2');
      const harvestData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint8', 'uint256'],
        [EtherfiWithdrawType.RequestWithdraw, harvestAmount]
      );
      await vault.connect(user1).harvest(ProtocolType.Etherfi, harvestData);

      // claim withdraw
      const claimData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint8', 'uint256'],
        [EtherfiWithdrawType.ClaimWithdraw, 1]
      );

      await expect(vault.connect(user1).harvest(ProtocolType.Etherfi, claimData)).to.be.revertedWithCustomError(
        etherfiAdapter,
        'InvalidWithdrawRequest'
      );
    });

    it('harvest should fail when request not finalized', async () => {
      const { vault, user1, user2, weth, etherFi, etherfiAdapter } = await loadFixture(
        deployTestSystemWithConfiguredWethVault
      );

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      await vault.connect(user1).updateTotalLent();

      const seedAmount = parseEther('3');
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Etherfi, seedData);

      // request withdraw
      const harvestAmount = parseEther('2');
      const harvestData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint8', 'uint256'],
        [EtherfiWithdrawType.RequestWithdraw, harvestAmount]
      );
      await vault.connect(user1).harvest(ProtocolType.Etherfi, harvestData);

      await etherFi.withdrawRequestNFT.setWithdrawalStatus(1, true, false, false);

      // claim withdraw
      const claimData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint8', 'uint256'],
        [EtherfiWithdrawType.ClaimWithdraw, 1]
      );

      await expect(vault.connect(user1).harvest(ProtocolType.Etherfi, claimData)).to.be.revertedWithCustomError(
        etherfiAdapter,
        'InvalidWithdrawRequest'
      );
    });

    it('harvest should fail when requestId not found', async () => {
      const { vault, user1, user2, weth, etherFi, etherfiAdapter } = await loadFixture(
        deployTestSystemWithConfiguredWethVault
      );

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      await vault.connect(user1).updateTotalLent();

      const seedAmount = parseEther('3');
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Etherfi, seedData);

      // claim withdraw
      const claimData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint8', 'uint256'],
        [EtherfiWithdrawType.ClaimWithdraw, 1]
      );

      await expect(vault.connect(user1).harvest(ProtocolType.Etherfi, claimData)).to.be.revertedWithCustomError(
        etherfiAdapter,
        'NoUnstakeRequest'
      );
    });

    it('harvest should fail when withdraw type is invalid', async () => {
      const { vault, user1, user2, weth } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);
      await vault.connect(user1).updateTotalLent();

      const seedAmount = parseEther('3');
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Etherfi, seedData);

      const invalidWithdrawType = 5;
      const harvestData = ethers.AbiCoder.defaultAbiCoder().encode(['uint8', 'uint256'], [invalidWithdrawType, 1]);

      await expect(vault.connect(user1).harvest(ProtocolType.Etherfi, harvestData)).to.be.reverted;
    });

    it('updateTotalLent / getTotalLent', async () => {
      const { vault, user1, user2, weth } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const seedAmount = parseEther('3');
      const seedData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [seedAmount]);
      await vault.connect(user1).seed(ProtocolType.Etherfi, seedData);

      await vault.connect(user1).updateTotalLent();
      expect(await vault.connect(user1).getTotalLent()).to.equal(seedAmount);
    });
  });
});
