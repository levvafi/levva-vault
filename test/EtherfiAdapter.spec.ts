import { parseEther } from 'ethers';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployTestSystemWithConfiguredWethVault } from './shared/fixtures';
import {
  encodeEtherfiClaimWithdraw,
  encodeEtherfiDeposit,
  encodeEtherfiRequestWithdraw,
  encodeResult,
  ProtocolType,
} from './shared/utils';

describe('Etherfi', () => {
  describe('Config', async () => {
    it('enqueue withdraw request', async () => {
      const { user1, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      await configManager.addVault(user1, true);

      const requestId = 1;
      const withdrawAmount = parseEther('2');
      await configManager.connect(user1).enqueueUnstakeRequest(requestId, withdrawAmount);

      const firstRequestId = await configManager.peekUnstakeRequestId(user1);
      expect(firstRequestId).to.equal(requestId);
    });

    it('enqueue withdraw request should fail when not authorized', async () => {
      const { user2, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const requestId = 1;
      const withdrawAmount = parseEther('2');
      await expect(
        configManager.connect(user2).enqueueUnstakeRequest(requestId, withdrawAmount)
      ).to.be.revertedWithCustomError(configManager, 'SenderIsNotVault');
    });

    it('dequeue withdraw request', async () => {
      const { user1, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

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
      const { user1, user2, configManager } = await loadFixture(deployTestSystemWithConfiguredWethVault);

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
    it('deposit', async () => {
      const { vault, user1, user2, weth } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const etherfiDepositAmount = parseEther('3');
      const eherfiDepositAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(etherfiDepositAmount),
      };
      await vault.connect(user1).executeProtocolAction([eherfiDepositAction]);
    });

    it('withdraw', async () => {
      const { vault, user1, user2, weth, etherFi, etherfiAdapter } = await loadFixture(
        deployTestSystemWithConfiguredWethVault
      );

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const etherfiDepositAmount = parseEther('3');
      const eherfiDepositAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(etherfiDepositAmount),
      };
      await vault.connect(user1).executeProtocolAction([eherfiDepositAction]);

      // request withdraw
      const requestWithdrawAmount = parseEther('2');
      const eherfiWithdrawAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiRequestWithdraw(requestWithdrawAmount),
      };
      await vault.connect(user1).executeProtocolAction([eherfiWithdrawAction]);

      const [requestWithdrawEvent] = await vault.queryFilter(
        etherfiAdapter.filters['EtherfiRequestWithdraw(uint256,uint256)'],
        -1
      );
      expect(requestWithdrawEvent.args[0]).to.eq(1);
      expect(requestWithdrawEvent.args[1]).to.eq(requestWithdrawAmount);

      // etherfi finalize requests
      await etherFi.withdrawRequestNFT.setWithdrawalStatus(1, true, false, true);

      // claim withdraw
      const eherfiClaimWtihdrawAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiClaimWithdraw(),
      };
      await vault.connect(user1).executeProtocolAction([eherfiClaimWtihdrawAction]);

      const [claimWithdrawEvent] = await vault.queryFilter(
        etherfiAdapter.filters['EtherfiClaimWithdraw(uint256,uint256)'],
        -1
      );
      expect(claimWithdrawEvent.args[0]).to.eq(1);
      expect(claimWithdrawEvent.args[1]).to.eq(requestWithdrawAmount);
    });

    it('claimWithdraw should fail when request not finalized', async () => {
      const { vault, user1, user2, weth, etherfiAdapter } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const eherfiDepositAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(parseEther('3')),
      };
      await vault.connect(user1).executeProtocolAction([eherfiDepositAction]);

      // request withdraw
      const requestWithdrawAmount = parseEther('2');
      const eherfiWithdrawAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiRequestWithdraw(requestWithdrawAmount),
      };
      await vault.connect(user1).executeProtocolAction([eherfiWithdrawAction]);

      // claim withdraw
      const eherfiClaimWtihdrawAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiClaimWithdraw(),
      };

      await expect(
        vault.connect(user1).executeProtocolAction([eherfiClaimWtihdrawAction])
      ).to.be.revertedWithCustomError(etherfiAdapter, 'InvalidWithdrawRequest');
    });

    it('claimWithdraw should fail when request not finalized', async () => {
      const { vault, user1, user2, weth, etherFi, etherfiAdapter } = await loadFixture(
        deployTestSystemWithConfiguredWethVault
      );

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const eherfiDepositAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(parseEther('3')),
      };
      await vault.connect(user1).executeProtocolAction([eherfiDepositAction]);

      // request withdraw
      const requestWithdrawAmount = parseEther('2');
      const eherfiWithdrawAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiRequestWithdraw(requestWithdrawAmount),
      };
      await vault.connect(user1).executeProtocolAction([eherfiWithdrawAction]);

      await etherFi.withdrawRequestNFT.setWithdrawalStatus(1, true, false, false);

      // claim withdraw
      const eherfiClaimWtihdrawAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiClaimWithdraw(),
      };

      await expect(
        vault.connect(user1).executeProtocolAction([eherfiClaimWtihdrawAction])
      ).to.be.revertedWithCustomError(etherfiAdapter, 'InvalidWithdrawRequest');
    });

    it('claim withdraw should fail when requestId not found', async () => {
      const { vault, user1, user2, weth, etherfiAdapter } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const eherfiDepositAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(parseEther('3')),
      };
      await vault.connect(user1).executeProtocolAction([eherfiDepositAction]);

      // claim withdraw
      const eherfiClaimWtihdrawAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiClaimWithdraw(),
      };

      await expect(
        vault.connect(user1).executeProtocolAction([eherfiClaimWtihdrawAction])
      ).to.be.revertedWithCustomError(etherfiAdapter, 'NoUnstakeRequest');
    });

    it('updateTotalLent / getTotalLent', async () => {
      const { vault, user1, user2, weth } = await loadFixture(deployTestSystemWithConfiguredWethVault);

      const depositAmount = parseEther('10');
      await weth.connect(user2).deposit({ value: depositAmount });
      await weth.connect(user2).approve(vault, depositAmount);
      await vault.connect(user2).deposit(depositAmount, user2);

      const etherfiDepositAmount = parseEther('3');
      const eherfiDepositAction = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(etherfiDepositAmount),
      };
      await vault.connect(user1).executeProtocolAction([eherfiDepositAction]);

      expect(await vault.connect(user1).getTotalLent()).to.equal(etherfiDepositAmount);
    });
  });
});
