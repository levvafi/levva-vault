import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadUpgradeConfig } from '../deploy/config';
import { makeUpgrade } from '../deploy/index';
import { formatEther, parseEther, Signer } from 'ethers';
import { ethers } from '@nomiclabs/hardhat-ethers'; //do not remove this import

interface UpgradeArgs {
  networkName: string;
  creatorKey: string;
  isPrivateKey: boolean;
}

/*
 *  Deploy on fork / dry-run deploy:
 *  npx hardhat --network hardhat --config hardhat-arb-fork.config.ts task:upgrade --network-name <network-name> --creator-key <key>
 *
 *  Deploy on real network:
 *  npx hardhat --network <network-name> --config hardhat.config.ts task:upgrade --network-name <network-name> --creator-key <key> --is-private-key
 */
task('task:upgrade', 'Upgrade vault implementations')
  .addParam<string>('networkName', 'Network name')
  .addParam<string>('creatorKey', 'Private or public key of contracts creator')
  .addFlag('isPrivateKey', 'If passed `creatorKey` is the private one')
  .setAction(async (taskArgs: UpgradeArgs, hre: HardhatRuntimeEnvironment) => {
    const dryRun =
      hre.config.networks.hardhat.forking !== undefined ? hre.config.networks.hardhat.forking.enabled : false;

    const network = taskArgs.networkName.toLowerCase();
    if (!dryRun && hre.network.name.toLowerCase() !== network) {
      throw new Error(`The network from the config and from CLI "--network" must be same!`);
    }

    const provider = hre.ethers.provider;

    if (dryRun) {
      console.log(`Dry run command on fork`);
      const blockNumber = await provider.getBlockNumber();
      console.log(`Fork block number: ${blockNumber}`);
    }

    let signer: Signer;
    if (taskArgs.isPrivateKey) {
      signer = new hre.ethers.Wallet(taskArgs.creatorKey, provider);
      console.log(`Signer from private key: ${await signer.getAddress()}`);
    } else if (dryRun) {
      console.log(`Impersonating signer: ${taskArgs.creatorKey}`);
      signer = await hre.ethers.getImpersonatedSigner(taskArgs.creatorKey);
      console.log('Funding signer');
      const [user] = await hre.ethers.getSigners();
      const signerAddress = await signer.getAddress();
      await user.sendTransaction({
        to: signerAddress,
        value: parseEther('1.0'),
      });
      console.log(`Sent 1 ETH to deployer${signerAddress}`);
    } else {
      throw new Error("Can't impersonate signer while not dry-running");
    }

    const config = await loadUpgradeConfig(network, provider, dryRun);

    const balanceBefore = await signer.provider!.getBalance(signer);
    console.log(`Balance before: ${formatEther(balanceBefore)} Eth`);

    await makeUpgrade(signer, config, network, dryRun, hre);

    const balanceAfter = await signer.provider!.getBalance(signer);
    console.log(`Balance after: ${hre.ethers.formatEther(balanceAfter)} Eth`);

    console.log(`Spent for upgrade: ${hre.ethers.formatEther(balanceBefore - balanceAfter)} Eth`);
    console.log(`Done!`);
  });
