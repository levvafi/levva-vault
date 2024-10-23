import { task } from 'hardhat/config';
import { parseEther, formatEther, Signer } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadDeployConfig } from '../deploy/config';
import { makeDeploy, makeDeployContractRegistry } from '../deploy/index';
import { showGasUsed } from '../deploy/utils';
import { ethers } from '@nomiclabs/hardhat-ethers'; //do not remove this import

interface DeployArgs {
  networkName: string;
  creatorKey: string;
  isPrivateKey: boolean;
}

/*
 *  Deploy on fork / dry-run deploy:
 *  npx hardhat --network hardhat --config hardhat-arb-fork.config.ts task:deploy --network-name <network-name> --creator-key <public-or-private-key>
 *
 *  Deploy on real network:
 *  npx hardhat --network <network-name> --config hardhat.config.ts task:deploy --network-name <network-name> --creator-key <private-key> --is-private-key
 */

task('task:deploy', 'Deploy vaults')
  .addParam<string>('networkName', 'Network name')
  .addParam<string>('creatorKey', 'Private or public key of contracts creator')
  .addFlag('isPrivateKey', 'If passed `creatorKey` is the private one')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const dryRun =
      hre.config.networks.hardhat.forking !== undefined ? hre.config.networks.hardhat.forking.enabled : false;

    const network = taskArgs.networkName.toLowerCase();
    if (!dryRun && hre.network.name.toLowerCase() !== network) {
      throw new Error(`The network from the config and from CLI "--network" must be same!`);
    }

    const provider = hre.ethers.provider;
    const startBlockNumber = await provider.getBlockNumber();

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

    const config = await loadDeployConfig(network, signer.provider!, dryRun);

    const balanceBefore = await signer.provider!.getBalance(signer);
    console.log(`Balance before: ${formatEther(balanceBefore)} Eth`);

    await makeDeploy(signer, config, network, dryRun, hre);

    const balanceAfter = await signer.provider!.getBalance(signer);
    console.log(`Balance after: ${formatEther(balanceAfter)} Eth`);

    console.log(`Spent for deploy: ${formatEther(balanceBefore - balanceAfter)} Eth`);
    if (dryRun) {
      const currentBlockNumber = await provider.getBlockNumber();
      // skip first two blocks
      // first block - current block of fork
      // second block - funding deployer account
      await showGasUsed(hre, startBlockNumber + 2, currentBlockNumber);
    }

    console.log(`Done!`);
  });

/*
 *  Deploy on fork / dry-run deploy:
 *  npx hardhat --network hardhat --config hardhat-arb-fork.config.ts task:deploy-contract-registry --network-name <network-name> --creator-key <public-or-private-key>
 *
 *  Deploy on real network:
 *  npx hardhat --network <network-name> --config hardhat.config.ts task:deploy-contract-registry --network-name <network-name> --creator-key <private-key> --is-private-key
 */

task('task:deploy-contract-registry', 'Deploy contract registry')
  .addParam<string>('networkName', 'Network name')
  .addParam<string>('creatorKey', 'Private or public key of contracts creator')
  .addFlag('isPrivateKey', 'If passed `creatorKey` is the private one')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const dryRun =
      hre.config.networks.hardhat.forking !== undefined ? hre.config.networks.hardhat.forking.enabled : false;

    const network = taskArgs.networkName.toLowerCase();
    if (!dryRun && hre.network.name.toLowerCase() !== network) {
      throw new Error(`The network from the config and from CLI "--network" must be same!`);
    }

    const provider = hre.ethers.provider;

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

    const config = await loadDeployConfig(network, signer.provider!, dryRun);

    const balanceBefore = await signer.provider!.getBalance(signer);
    console.log(`Balance before: ${formatEther(balanceBefore)} Eth`);

    await makeDeployContractRegistry(signer, config, network, dryRun, hre);

    const balanceAfter = await signer.provider!.getBalance(signer);
    console.log(`Balance after: ${formatEther(balanceAfter)} Eth`);

    console.log(`Spent for deploy: ${formatEther(balanceBefore - balanceAfter)} Eth`);
    console.log(`Done!`);
  });
