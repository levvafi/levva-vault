import { task } from 'hardhat/config';
import { parseEther, formatEther, Signer, BigNumberish } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadDeployConfig, TimelockConfig } from '../deploy/config';
import { makeDeploy, makeDeployContractRegistry, makeDeployTimelock } from '../deploy/index';
import { showGasUsed } from '../deploy/utils';
import { ethers } from '@nomiclabs/hardhat-ethers'; //do not remove this import
import { Vault__factory } from '../typechain-types';

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
    const { dryRun, network, signer, balanceBefore, startBlockNumber } = await beforeDeploy(taskArgs, hre);

    const config = await loadDeployConfig(network, signer.provider!, dryRun);
    await makeDeploy(signer, config, network, dryRun, hre);

    await afterDeploy(dryRun, signer, balanceBefore, startBlockNumber, hre);
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
    const { dryRun, network, signer, balanceBefore, startBlockNumber } = await beforeDeploy(taskArgs, hre);

    const config = await loadDeployConfig(network, signer.provider!, dryRun);
    await makeDeployContractRegistry(signer, config, network, dryRun, hre);

    await afterDeploy(dryRun, signer, balanceBefore, startBlockNumber, hre);
  });

/*
 *  Deploy on fork / dry-run deploy:
 *  npx hardhat --network hardhat --config hardhat-arb-fork.config.ts task:deploy-timelock --network-name <network-name> --creator-key <public-or-private-key>
 *
 *  Deploy on real network:
 *  npx hardhat --network <network-name> --config hardhat.config.ts task:deploy-timelock --network-name <network-name> --creator-key <private-key> --is-private-key
 */
task('task:deploy-timelock', 'Deploy timelock contract and transfer ownership from vault to TL')
  .addParam<string>('networkName', 'Network name')
  .addParam<string>('creatorKey', 'Private or public key of contracts creator')
  .addFlag('isPrivateKey', 'If passed `creatorKey` is the private one')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const { startBlockNumber, dryRun, signer, balanceBefore, network } = await beforeDeploy(taskArgs, hre);

    const proposers = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];
    const executors = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];

    const vaultInterface = Vault__factory.createInterface();
    const acceptOwnership = vaultInterface.getFunction('acceptOwnership').selector;
    const setMinDeposit = vaultInterface.getFunction('setMinDeposit').selector;
    const addVaultManager = vaultInterface.getFunction('addVaultManager').selector;

    const ownerMethods = [acceptOwnership, setMinDeposit, addVaultManager];

    const whitelisted: [string, string[]][] = [
      ['0xe8632C0BA276B245988885A37E3B1A3CeeD0D469', ownerMethods], // WBTC-Vault
      ['0x7b8Ef421D69341cC04A926EF00d27f9d7dBe0b3F', ownerMethods], // WETH-1-Vault
      ['0x2e894952809C3D48937fA1FFc689953358E1e1b0', ownerMethods], // WETH-2-Vault
      ['0xe1942DCf28E11D2335F471D1Df88A4CFc8b43A0e', ownerMethods], // eBTC-Vault
      ['0xd8F7bD3b76B07a1141B933286f1F2EaeC84bdAea', ownerMethods], // LBTC-Vault
    ];

    const whitelistedTargets = whitelisted.flatMap((x) => (<string[]>x[1]).map((_) => x[0]));
    const whitelistedMethods = whitelisted.flatMap((x) => x[1]);

    const config: TimelockConfig = {
      proposers: proposers,
      executors: executors,
      whitelistedTargets: whitelistedTargets,
      whitelistedMethods: whitelistedMethods,
    };

    console.log(whitelistedTargets);
    console.log(whitelistedMethods);

    await makeDeployTimelock(signer, config, network, false, hre);

    await afterDeploy(dryRun, signer, balanceBefore, startBlockNumber, hre);
  });

/**
 * Deploy initialization, funding signer when in dryRun mode
 * Save eth balance and startBlockNumber
 */
export async function beforeDeploy(taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) {
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

  const balanceBefore = await signer.provider!.getBalance(signer);
  console.log(`Balance before: ${formatEther(balanceBefore)} Eth`);

  return { dryRun, network, provider, signer, balanceBefore, startBlockNumber };
}

export async function afterDeploy(
  dryRun: boolean,
  signer: Signer,
  balanceBefore: bigint,
  startBlockNumber: number,
  hre: HardhatRuntimeEnvironment
) {
  const balanceAfter = await signer.provider!.getBalance(signer);
  console.log(`Balance after: ${formatEther(balanceAfter)} Eth`);

  console.log(`Spent for deploy: ${formatEther(balanceBefore - balanceAfter)} Eth`);
  if (dryRun) {
    const currentBlockNumber = await signer.provider!.getBlockNumber();
    // skip first two blocks
    // first block - current block of fork
    // second block - funding deployer account
    await showGasUsed(hre, startBlockNumber + 2, currentBlockNumber);
  }
  console.log(`Done!`);
}
