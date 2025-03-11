import { task } from 'hardhat/config';
import { parseEther, formatEther, Signer, BigNumberish } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { loadDeployConfig, TimelockConfig } from '../deploy/config';
import { makeDeploy, makeDeployContractRegistry, makeDeployTimelock } from '../deploy/index';
import { showGasUsed } from '../deploy/utils';
import { ethers } from '@nomiclabs/hardhat-ethers'; //do not remove this import
import { Vault__factory } from '../typechain-types';
import { afterDeploy, beforeDeploy, DeployArgs, deployTask } from './utils';

/*
 *  Deploy on fork / dry-run deploy:
 *  npx hardhat --network hardhat --config hardhat-arb-fork.config.ts task:deploy --network-name <network-name> --impersonate-signer <address>
 *
 *  Deploy on real network:
 *  npx hardhat --network <network-name> --config hardhat.config.ts task:deploy --network-name <network-name> --creator-key <private-key> --is-private-key
 */

deployTask('task:deploy', 'Deploy vaults').setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
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

deployTask('task:deploy-contract-registry', 'Deploy contract registry').setAction(
  async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const { dryRun, network, signer, balanceBefore, startBlockNumber } = await beforeDeploy(taskArgs, hre);

    const config = await loadDeployConfig(network, signer.provider!, dryRun);
    await makeDeployContractRegistry(signer, config, network, dryRun, hre);

    await afterDeploy(dryRun, signer, balanceBefore, startBlockNumber, hre);
  }
);

/*
 *  Deploy on fork / dry-run deploy:
 *  npx hardhat --network hardhat --config hardhat-arb-fork.config.ts task:deploy-timelock --network-name <network-name> --creator-key <public-or-private-key>
 *
 *  Deploy on real network:
 *  npx hardhat --network <network-name> --config hardhat.config.ts task:deploy-timelock --network-name <network-name> --creator-key <private-key> --is-private-key
 */
deployTask('task:deploy-timelock', 'Deploy timelock contract and transfer ownership from vault to TL').setAction(
  async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
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
  }
);
