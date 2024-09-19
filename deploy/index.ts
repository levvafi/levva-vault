import { Signer } from 'ethers';
import { DeployConfig, EthConnectionConfig, VaultConfig } from './config';
import {
  Vault__factory,
  Vault,
  ConfigManager,
  ConfigManager__factory,
  AaveAdapter__factory,
  AaveAdapter,
  MarginlyAdapter__factory,
  MarginlyAdapter,
  EtherfiAdapter__factory,
  EtherfiAdapter,
} from '../typechain-types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { createDefaultBaseState, DeployState, StateFile, StateStore } from './state-store';
import { SimpleLogger } from './logger';
import fs from 'fs';
import path from 'path';
import { createDefaultBaseDeployment, DeploymentFile, DeploymentState, DeploymentStore } from './deployment-store';
import '@openzeppelin/hardhat-upgrades';

enum ProtocolType {
  Marginly = 0, //0
  Aave = 1, //1
  Etherfi = 2, //2
}

type AdapterAddress = {
  protocolType: ProtocolType;
  adapterImpl: string;
};

export async function deployVault(
  signer: Signer,
  config: DeployConfig,
  network: string,
  dryRun: boolean,
  hre: HardhatRuntimeEnvironment
) {
  const statesDirName = 'states';
  const stateFileName = getStateFileName(network, statesDirName);
  const actualStateFile = path.join(__dirname, `data`, `configs`, network, stateFileName);
  const actualDeploymentFile = path.join(__dirname, `data`, `contracts`, `${network}.json`);

  const logger = new SimpleLogger((x) => console.error(x));
  const stateStore = new StateFile(
    'LevvaVaults',
    createDefaultBaseState,
    actualStateFile,
    !dryRun,
    logger
  ).createStateStore();

  const deploymentStore = new DeploymentFile(
    'LevvaVaults',
    createDefaultBaseDeployment,
    actualDeploymentFile,
    !dryRun,
    logger
  ).createDeploymentStore();

  const configManager = await deployConfigManager(signer, config, hre, stateStore, deploymentStore);
  const adapters = await deployAdapters(signer, config, hre, stateStore, deploymentStore, configManager);
  await deployVaults(signer, config, hre, stateStore, deploymentStore, configManager, adapters);

  console.log(`State file: \n${stateStore.stringify()}`);
  console.log(`Deployment file: \n${deploymentStore.stringify()}`);
}

async function getTxOverrides(hre: HardhatRuntimeEnvironment) {
  const blockNumber = await hre.ethers.provider.provider.getBlockNumber();
  const maxFeePerGas = (await hre.ethers.provider.getBlock(blockNumber))!.baseFeePerGas! * 10n;
  return { maxFeePerGas, maxPriorityFeePerGas: maxFeePerGas };
}

async function deployConfigManager(
  signer: Signer,
  config: DeployConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore
): Promise<ConfigManager> {
  console.log(`Deploy ConfigManager.`);

  const proxyId = 'configManager-proxy';
  const implId = 'configManager-impl';
  const deploymentId = 'configManager';

  const txOverrides = await getTxOverrides(hre);

  const state = stateStore.getById(proxyId);
  let configManagerAddress: string;
  let configManager: ConfigManager;
  if (state !== undefined) {
    console.log(`ConfigManager already deployed. Skip.`);
    configManagerAddress = state.address;
    configManager = ConfigManager__factory.connect(configManagerAddress, signer);
  } else {
    const constructorArgs: any[] = [config.configurationManager.weth9, config.configurationManager.weeth];
    configManager = (await hre.upgrades.deployProxy(new ConfigManager__factory().connect(signer), constructorArgs, {
      initializer: 'initialize',
      txOverrides,
    })) as unknown as ConfigManager;

    await configManager.waitForDeployment();
    configManagerAddress = await configManager.getAddress();

    const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(configManagerAddress);
    console.log(`ConfigManager proxy: ${configManagerAddress}, implementation: ${implementationAddress}`);

    const txHash = configManager.deploymentTransaction()?.hash;

    stateStore.setById(proxyId, <DeployState>{ address: configManagerAddress, txHash });
    stateStore.setById(implId, <DeployState>{ address: implementationAddress });
    deploymentStore.setById(deploymentId, <DeploymentState>{
      address: configManagerAddress,
      implementation: implementationAddress,
    });

    await verifyContract(hre, implementationAddress, []);
  }

  if ((await configManager.getAavePool()) !== config.configurationManager.aavePool) {
    console.log(`Set ConfigManager Aave pool to ${config.configurationManager.aavePool}`);
    await configManager.setAavePool(config.configurationManager.aavePool);
  }

  return configManager;
}

/**
 * Deploys adapters. Adapters is non upgradeable contracts
 */

async function deployAdapters(
  signer: Signer,
  config: DeployConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore,
  configManager: ConfigManager
): Promise<AdapterAddress[]> {
  const adapters: AdapterAddress[] = [];

  for (const adapter of config.adapters) {
    switch (adapter.type) {
      case 'aave':
        const aaveAdapter = await deployAaveAdapter(signer, config, hre, stateStore, deploymentStore, configManager);
        adapters.push({ protocolType: ProtocolType.Aave, adapterImpl: await aaveAdapter.getAddress() });
        break;
      case 'marginly':
        const marginlyAdapter = await deployMarginlyAdapter(
          signer,
          config,
          hre,
          stateStore,
          deploymentStore,
          configManager
        );
        adapters.push({ protocolType: ProtocolType.Marginly, adapterImpl: await marginlyAdapter.getAddress() });
        break;
      case 'etherfi':
        const etherfiAdapter = await deployEtherfiAdapter(
          signer,
          config,
          hre,
          stateStore,
          deploymentStore,
          configManager
        );
        adapters.push({ protocolType: ProtocolType.Etherfi, adapterImpl: await etherfiAdapter.getAddress() });
        break;
      default:
        throw new Error(`Unknown adapter type: ${adapter.type}`);
    }
  }

  return adapters;
}

async function deployAaveAdapter(
  signer: Signer,
  config: DeployConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore,
  configManager: ConfigManager
): Promise<AaveAdapter> {
  console.log(`Deploy AaveAdapter.`);

  const contractId = 'aaveAdapter';
  const txOverrides = await getTxOverrides(hre);

  const state = stateStore.getById(contractId);
  let aaveAdapterAddress: string;
  let aaveAdapter: AaveAdapter;
  if (state !== undefined) {
    console.log(`AaveAdapter already deployed. Skip.`);
    aaveAdapterAddress = state.address;
    aaveAdapter = AaveAdapter__factory.connect(aaveAdapterAddress, signer);
  } else {
    aaveAdapter = (await new AaveAdapter__factory().connect(signer).deploy(txOverrides)) as unknown as AaveAdapter;
    await aaveAdapter.waitForDeployment();
    aaveAdapterAddress = await aaveAdapter.getAddress();

    const txHash = aaveAdapter.deploymentTransaction()?.hash;

    stateStore.setById(contractId, <DeployState>{ address: aaveAdapterAddress, txHash });
    deploymentStore.setById(contractId, <DeploymentState>{ address: aaveAdapterAddress });

    await verifyContract(hre, aaveAdapterAddress, []);

    console.log(`AaveAdapter deployed: ${aaveAdapterAddress}, txHash: ${txHash}`);
  }

  console.log(`\n`);

  return aaveAdapter;
}

async function deployMarginlyAdapter(
  signer: Signer,
  config: DeployConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore,
  configManager: ConfigManager
): Promise<MarginlyAdapter> {
  console.log(`Deploy MarginlyAdapter.`);

  const contractId = 'marginlyAdapter';
  const txOverrides = await getTxOverrides(hre);

  const state = stateStore.getById(contractId);
  let marginlyAdapterAddress: string;
  let marginlyAdapter: MarginlyAdapter;

  if (state !== undefined) {
    console.log(`MarginlyAdapter already deployed. Skip.`);
    marginlyAdapterAddress = state.address;
    marginlyAdapter = MarginlyAdapter__factory.connect(marginlyAdapterAddress, signer);
  } else {
    marginlyAdapter = (await new MarginlyAdapter__factory()
      .connect(signer)
      .deploy(txOverrides)) as unknown as MarginlyAdapter;
    await marginlyAdapter.waitForDeployment();
    marginlyAdapterAddress = await marginlyAdapter.getAddress();

    const txHash = marginlyAdapter.deploymentTransaction()?.hash;

    stateStore.setById(contractId, <DeployState>{ address: marginlyAdapterAddress, txHash });
    deploymentStore.setById(contractId, <DeploymentState>{ address: marginlyAdapterAddress });

    await verifyContract(hre, marginlyAdapterAddress, []);

    console.log(`MarginlyAdapter deployed: ${marginlyAdapterAddress}, txHash: ${txHash}`);
  }

  console.log(`\n`);

  return marginlyAdapter;
}

async function deployEtherfiAdapter(
  signer: Signer,
  config: DeployConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore,
  configManager: ConfigManager
): Promise<EtherfiAdapter> {
  console.log(`Deploy EtherfiAdapter.`);

  const contractId = 'etherFiAdapter';
  const txOverrides = await getTxOverrides(hre);

  const state = stateStore.getById(contractId);
  let etherfiAdapterAddress: string;
  let etherfiAdapter: EtherfiAdapter;

  if (state !== undefined) {
    console.log(`EtherfiAdapter already deployed. Skip.`);
    etherfiAdapterAddress = state.address;
    etherfiAdapter = EtherfiAdapter__factory.connect(etherfiAdapterAddress, signer);
  } else {
    etherfiAdapter = (await new EtherfiAdapter__factory()
      .connect(signer)
      .deploy(txOverrides)) as unknown as EtherfiAdapter;
    await etherfiAdapter.waitForDeployment();
    etherfiAdapterAddress = await etherfiAdapter.getAddress();

    const txHash = etherfiAdapter.deploymentTransaction()?.hash;

    stateStore.setById(contractId, <DeployState>{ address: etherfiAdapterAddress, txHash });
    deploymentStore.setById(contractId, <DeploymentState>{ address: etherfiAdapterAddress });

    await verifyContract(hre, etherfiAdapterAddress, []);

    console.log(`EtherfiAdapter deployed: ${etherfiAdapterAddress}, txHash: ${txHash}`);
  }

  console.log(`\n`);

  return etherfiAdapter;
}

async function deployVaults(
  signer: Signer,
  config: DeployConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore,
  configManager: ConfigManager,
  adapters: AdapterAddress[]
) {
  console.log(`Deploy Vaults.`);
  const configManagerAddress = await configManager.getAddress();

  for (const vaultConfig of config.vaults) {
    console.log(`Deploy vault ${vaultConfig.id}.`);

    const underlyingToken = config.tokens.find((x) => x.id === vaultConfig.tokenId);
    if (underlyingToken === undefined) {
      throw new Error(`Underlying token not found in config by tokenId: ${vaultConfig.tokenId}`);
    }

    const proxyId = `vault-${vaultConfig.id}-proxy`;
    const implId = `vault-${vaultConfig.id}-impl`;
    const deploymentId = `vault-${vaultConfig.id}`;

    const txOverrides = await getTxOverrides(hre);

    const state = stateStore.getById(proxyId);
    let vaultAddress: string;
    let vault: Vault;
    if (state !== undefined) {
      console.log(`Vault ${vaultConfig.id} already deployed. Skip.`);
      vaultAddress = state.address;
      vault = Vault__factory.connect(vaultAddress, signer);
    } else {
      const constructorArgs: any[] = [
        underlyingToken.address,
        vaultConfig.lpName,
        vaultConfig.lpSymbol,
        configManagerAddress,
      ];

      /*
       * Unsafe allow is needed because we call adapters with delegatecall. It is safe because only owner could set lending adapter
       */
      vault = (await hre.upgrades.deployProxy(new Vault__factory().connect(signer), constructorArgs, {
        initializer: 'initialize',
        txOverrides,
        unsafeAllow: ['delegatecall'],
        kind: 'uups',
      })) as unknown as Vault;

      await vault.waitForDeployment();
      vaultAddress = await vault.getAddress();

      const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(vaultAddress);
      console.log(`${deploymentId} proxy: ${vaultAddress}, implementation: ${implementationAddress}`);

      const txHash = vault.deploymentTransaction()?.hash;

      stateStore.setById(proxyId, <DeployState>{ address: vaultAddress, txHash });
      stateStore.setById(implId, <DeployState>{ address: implementationAddress });
      deploymentStore.setById(deploymentId, <DeploymentState>{
        address: vaultAddress,
        implementation: implementationAddress,
      });

      await verifyContract(hre, implementationAddress, []);

      console.log(`Vault ${vaultConfig.id} deployed: ${vaultAddress}, txHash: ${txHash}\n`);
    }

    console.log(`Check connected adapters`);
    for (const marginlyPool of vaultConfig.marginlyPools) {
      const poolConfig = await configManager.getPoolConfig(vaultAddress, marginlyPool);
      if (!poolConfig.initialized) {
        const tx = await configManager.connect(signer).addMarginlyPool(vaultAddress, marginlyPool);
        await tx.wait();

        console.log(`MarginlyPool ${marginlyPool} connected to vault ${vaultConfig.id}`);
      }
    }

    for (const adapterDescr of adapters) {
      const lendingAdapter = await vault.getLendingAdapter(adapterDescr.protocolType);
      if (lendingAdapter !== adapterDescr.adapterImpl) {
        const tx = await vault.connect(signer).addLendingAdapter(adapterDescr.protocolType, adapterDescr.adapterImpl);
        await tx.wait();

        console.log(`Set lending adapter ${adapterDescr.adapterImpl} protocolType ${adapterDescr.protocolType}`);
      }
    }
  }
}

async function verifyContract(hre: HardhatRuntimeEnvironment, address: string, constructorArguments: any[]) {
  const isDryRun = hre.config.networks.hardhat.forking !== undefined;
  if (!isDryRun) {
    console.log(`Verify contract ${address} with constructor arguments: ${constructorArguments}`);

    try {
      await hre.run('verify:verify', {
        address,
        constructorArguments,
      });
    } catch (e) {
      console.log(`Verify contract ${address} failed: ${e}`);
    }
  }
}

//TODO: move to another file
function getStateFileName(network: string, statesDirName: string): string {
  const dirName = path.join(__dirname, `data`, `configs`, network, statesDirName);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }

  if (!fs.statSync(dirName).isDirectory()) {
    throw new Error(`Not a directory: ${dirName}`);
  }

  let stateFilename = getLatestStateFileName(dirName);

  if (stateFilename === undefined) {
    const fileName = path.join(statesDirName, generateStateFileName(dirName));
    console.log(`Using new generated state file '${fileName}'`);
    return fileName;
  } else {
    const fileName = path.join(statesDirName, stateFilename);
    console.log(`Using latest state file '${fileName}'`);
    return fileName;
  }
}

function getLatestStateFileName(dirName: string): string | undefined {
  const fileNames = fs.readdirSync(dirName);
  const files = fileNames
    .map((x) => ({
      name: x,
      extension: path.extname(x),
      mtimeNs: fs.statSync(path.join(dirName, x), { bigint: true }).mtimeNs,
    }))
    .filter((x) => x.extension === '.json')
    .sort((a, b) => Number(b.mtimeNs - a.mtimeNs));

  if (files.length === 0) {
    return undefined;
  }

  return files[0].name;
}

function generateStateFileName(dirName: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = 1 + now.getUTCMonth();
  const day = now.getUTCDate();
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  let fileName = `${dateStr}.json`;
  if (fs.existsSync(path.join(dirName, fileName))) {
    const maxCount = 99;
    let n = 1;
    while (fs.existsSync(path.join(dirName, fileName))) {
      if (n === maxCount) {
        throw new Error('Too much state files today');
      }
      fileName = `${dateStr}_${n.toString().padStart(2, '0')}.json`;
      n++;
    }
  }
  return fileName;
}
