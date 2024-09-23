import { task } from 'hardhat/config';
import { parseEther } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadDeployConfig } from '../deploy/config';
import { deployVault } from '../deploy/index';
import { ethers } from '@nomiclabs/hardhat-ethers'; //do not remove this import

interface DeployArgs {
  networkName: string;
  creatorPrivateKey: string;
}

/*
 *  Deploy on fork / dry-run deploy:
 *  npx hardhat --network hardhat --config hardhat-arb-fork.config.ts task:deploy --network-name <network-name> --creator-private-key <private-key>
 *
 *  Deploy on real network:
 *  npx hardhat --network <network-name> --config hardhat.config.ts task:deploy --network-name <network-name> --creator-private-key <private-key>
 */

task('task:deploy', 'Deploy vaults')
  .addParam<string>('networkName', 'Network name')
  .addParam<string>('creatorPrivateKey', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const dryRun =
      hre.config.networks.hardhat.forking !== undefined ? hre.config.networks.hardhat.forking.enabled : false;

    const network = taskArgs.networkName.toLowerCase();
    if (!dryRun && hre.network.name.toLowerCase() !== network) {
      throw new Error(`The network from the config and from CLI "--network" must be same!`);
    }
    const signer = new hre.ethers.Wallet(taskArgs.creatorPrivateKey, hre.ethers.provider);

    if (dryRun) {
      console.log(`Dry run command on fork`);
      const blockNumber = await hre.ethers.provider.getBlockNumber();
      console.log(`Fork block number: ${blockNumber}`);
      const [user] = await hre.ethers.getSigners();
      await user.sendTransaction({
        to: signer.address,
        value: parseEther('1.0'),
      });
      console.log(`Sent 1 ETH to deployer${signer.address}`);
    }

    const config = await loadDeployConfig(network, signer.provider!, dryRun);

    const balanceBefore = await signer.provider!.getBalance(signer.address);
    console.log(`Balance before: ${hre.ethers.formatEther(balanceBefore)} Eth`);

    await deployVault(signer, config, network, dryRun, hre);

    const balanceAfter = await signer.provider!.getBalance(signer.address);
    console.log(`Balance after: ${hre.ethers.formatEther(balanceAfter)} Eth`);

    console.log(`Spent: ${hre.ethers.formatEther(balanceBefore - balanceAfter)} Eth`);
    console.log(`Done!`);
  });
