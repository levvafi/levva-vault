import {
  BytesLike,
  Contract,
  ContractTransactionReceipt,
  formatEther,
  formatUnits,
  parseUnits,
  Signer,
  TransactionReceipt,
  TransactionResponse,
  ZeroAddress,
} from 'ethers';
import { DeployConfig, UpgradeConfig, VaultConfig, TokenConfig, AdapterType, TimelockConfig } from './config';
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
  ContractRegistry,
  ContractRegistry__factory,
  ERC20__factory,
  TimelockWhitelist,
  TimelockWhitelist__factory,
} from '../typechain-types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { createDefaultBaseState, DeployState, StateFile, StateStore } from './state-store';
import { SimpleLogger } from './logger';
import fs from 'fs';
import path from 'path';
import { createDefaultBaseDeployment, DeploymentFile, DeploymentState, DeploymentStore } from './deployment-store';
import '@openzeppelin/hardhat-upgrades';
import { delay } from './utils';

enum ProtocolType {
  Marginly = 0, //0
  Aave = 1, //1
  Etherfi = 2, //2
}

type AdapterAddress = {
  type: AdapterType;
  protocolType: ProtocolType;
  adapterImpl: string;
};

function initStateStore(network: string, dryRun: boolean, logger: SimpleLogger): StateStore {
  const statesDirName = 'states';
  const stateFileName = getStateFileName(network, statesDirName);
  const actualStateFile = path.join(__dirname, `data`, `configs`, network, stateFileName);

  return new StateFile('LevvaVaults', createDefaultBaseState, actualStateFile, !dryRun, logger).createStateStore();
}

function initDeploymentStore(network: string, dryRun: boolean, logger: SimpleLogger): DeploymentStore {
  const actualDeploymentFile = path.join(__dirname, `data`, `contracts`, `${network}.json`);

  return new DeploymentFile(
    'LevvaVaults',
    createDefaultBaseDeployment,
    actualDeploymentFile,
    !dryRun,
    logger
  ).createDeploymentStore();
}

export async function makeDeployContractRegistry(
  signer: Signer,
  config: DeployConfig,
  network: string,
  dryRun: boolean,
  hre: HardhatRuntimeEnvironment
) {
  const logger = new SimpleLogger((x) => console.error(x));
  const stateStore = initStateStore(network, dryRun, logger);
  const deploymentStore = initDeploymentStore(network, dryRun, logger);

  const contractRegistry = await deployContractRegistry(signer, hre, stateStore, deploymentStore);

  console.log(`State file: \n${stateStore.stringify()}`);
  console.log(`Deployment file: \n${deploymentStore.stringify()}`);
}

export async function makeDeployTimelock(
  signer: Signer,
  config: TimelockConfig,
  network: string,
  dryRun: boolean,
  hre: HardhatRuntimeEnvironment
) {
  const logger = new SimpleLogger((x) => console.error(x));
  const stateStore = initStateStore(network, dryRun, logger);
  const deploymentStore = initDeploymentStore(network, dryRun, logger);

  await deployTimelock(signer, hre, stateStore, deploymentStore, config);

  console.log(`State file: \n${stateStore.stringify()}`);
  console.log(`Deployment file: \n${deploymentStore.stringify()}`);
}

export async function makeDeploy(
  signer: Signer,
  config: DeployConfig,
  network: string,
  dryRun: boolean,
  hre: HardhatRuntimeEnvironment
) {
  const logger = new SimpleLogger((x) => console.error(x));
  const stateStore = initStateStore(network, dryRun, logger);
  const deploymentStore = initDeploymentStore(network, dryRun, logger);

  const contractRegistry = await deployContractRegistry(signer, hre, stateStore, deploymentStore);
  const configManager = await deployConfigManager(signer, config, hre, stateStore, deploymentStore);
  const adapters = await deployAdapters(signer, config, hre, stateStore, deploymentStore, configManager);
  await deployVaults(signer, config, hre, stateStore, deploymentStore, configManager, contractRegistry, adapters);

  console.log(`State file: \n${stateStore.stringify()}`);
  console.log(`Deployment file: \n${deploymentStore.stringify()}`);
}

export async function makeUpgrade(
  signer: Signer,
  config: UpgradeConfig,
  network: string,
  dryRun: boolean,
  hre: HardhatRuntimeEnvironment
) {
  const logger = new SimpleLogger((x) => console.error(x));
  const stateStore = initStateStore(network, dryRun, logger);
  const deploymentStore = initDeploymentStore(network, dryRun, logger);

  await upgradeVaults(signer, config, hre, stateStore, deploymentStore);
  await upgradeConfigManager(signer, config, hre, stateStore, deploymentStore);
}

async function upgradeVaults(
  signer: Signer,
  config: UpgradeConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore
) {
  console.log(`Upgrade Vaults.`);

  for (const upgradeArgs of config.vaults) {
    const vaultId = getVaultProxyId(upgradeArgs.id);
    const implId = getVaultImplId(upgradeArgs.id);
    const deploymentId = getVaultDeploymentId(upgradeArgs.id);

    console.log(`Upgrade vault ${upgradeArgs.id}.`);

    const proxyState = stateStore.getById(vaultId);
    if (proxyState === undefined) {
      throw new Error(`Vault ${upgradeArgs.id} not found in state store`);
    }
    const implState = stateStore.getById(implId);
    if (implState === undefined) {
      throw new Error(`Vault implementation ${implId} not found in state store. Deploy vault first`);
    }

    const vaultProxyAddress = proxyState.address;
    const oldImplAddress = implState.address;

    const vaultImpl = await hre.upgrades.deployImplementation(new Vault__factory().connect(signer), {
      unsafeAllow: ['delegatecall'],
      redeployImplementation: 'onchange',
    });

    const vaultImplAddress = await getContractAddress(vaultImpl);

    if (vaultImplAddress != oldImplAddress) {
      const vaultProxy = await hre.upgrades.upgradeProxy(vaultProxyAddress, new Vault__factory().connect(signer), {
        unsafeAllow: ['delegatecall'],
        redeployImplementation: 'onchange',
      });

      const upgradeTx = vaultProxy.deployTransaction as any as TransactionResponse;
      await upgradeTx.wait();

      const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(vaultProxyAddress);

      stateStore.setById(implId, <DeployState>{ address: implementationAddress });
      deploymentStore.setById(deploymentId, <DeploymentState>{
        address: vaultProxyAddress,
        implementation: implementationAddress,
      });

      console.log(
        `Vault ${upgradeArgs.id} proxy ${vaultProxyAddress} upgraded to impl: ${implementationAddress} txHash: ${upgradeTx.hash}\n`
      );
    } else {
      console.log(`Upgrade skipped, implementation is not changed`);
    }

    await verifyContract(hre, vaultImplAddress, []);
  }
}

async function upgradeConfigManager(
  signer: Signer,
  config: UpgradeConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore
) {
  if (!config.configurationManager) return;

  console.log(`Upgrade ConfigManager.`);

  const configManagerId = 'configManager-proxy';
  const implId = 'configManager-impl';
  const deploymentId = 'configManager';

  const proxyState = stateStore.getById(configManagerId);
  if (proxyState === undefined) {
    throw new Error(`ConfigManager proxy is not found in state store`);
  }

  const implState = stateStore.getById(implId);
  if (implState === undefined) {
    throw new Error(`ConfigManager implementation is not found in state store`);
  }

  const oldImplementationAddress = implState.address;
  const configManagerProxyAddress = proxyState.address;

  const deployImplTx = await hre.upgrades.deployImplementation(new ConfigManager__factory().connect(signer), {
    unsafeAllow: ['delegatecall'],
    redeployImplementation: 'onchange',
  });

  const configManagerImplAddress = await getContractAddress(deployImplTx);

  if (configManagerImplAddress.toLowerCase() !== oldImplementationAddress.toLocaleLowerCase()) {
    const configManagerProxy = await hre.upgrades.upgradeProxy(
      configManagerProxyAddress,
      new ConfigManager__factory().connect(signer),
      {
        unsafeAllow: ['delegatecall'],
        redeployImplementation: 'onchange',
      }
    );

    const upgradeTx = configManagerProxy.deployTransaction as any as TransactionResponse;
    await upgradeTx.wait();

    const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(configManagerProxyAddress);

    stateStore.setById(implId, <DeployState>{ address: implementationAddress });
    deploymentStore.setById(deploymentId, <DeploymentState>{
      address: configManagerProxyAddress,
      implementation: implementationAddress,
    });

    console.log(
      `ConfigManager ${configManagerId} proxy ${configManagerProxyAddress} upgraded to impl: ${implementationAddress} txHash: ${upgradeTx.hash}\n`
    );
  } else {
    console.log(`Upgrade skipped, implementation is not changed`);
  }

  await verifyContract(hre, configManagerImplAddress, []);
}

async function getContractAddress(contractCreationTxOrAddress: string | TransactionResponse): Promise<string> {
  if (contractCreationTxOrAddress instanceof TransactionResponse) {
    const txReceipt = await contractCreationTxOrAddress.wait();
    return txReceipt?.contractAddress!;
  }

  return contractCreationTxOrAddress;
}

async function getTxOverrides(hre: HardhatRuntimeEnvironment) {
  const blockNumber = await hre.ethers.provider.provider.getBlockNumber();
  const maxFeePerGas = ((await hre.ethers.provider.getBlock(blockNumber))!.baseFeePerGas! * 130n) / 100n;
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

  if ((await configManager.getAavePoolAddressProvider()) !== config.configurationManager.aavePoolAddressProvider) {
    console.log(`Set ConfigManager Aave pool to ${config.configurationManager.aavePoolAddressProvider}`);
    await configManager.setAavePoolAddressProvider(config.configurationManager.aavePoolAddressProvider);
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
        adapters.push({ type: 'aave', protocolType: ProtocolType.Aave, adapterImpl: await aaveAdapter.getAddress() });
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
        adapters.push({
          type: 'marginly',
          protocolType: ProtocolType.Marginly,
          adapterImpl: await marginlyAdapter.getAddress(),
        });
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
        adapters.push({
          type: 'etherfi',
          protocolType: ProtocolType.Etherfi,
          adapterImpl: await etherfiAdapter.getAddress(),
        });
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

function getVaultProxyId(id: string): string {
  return `vault-${id}-proxy`;
}

function getVaultImplId(id: string): string {
  return `vault-${id}-impl`;
}

function getVaultDeploymentId(id: string): string {
  return `vault-${id}`;
}

async function deployVaults(
  signer: Signer,
  config: DeployConfig,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore,
  configManager: ConfigManager,
  contractRegistry: ContractRegistry,
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

    const proxyId = getVaultProxyId(vaultConfig.id);
    const implId = getVaultImplId(vaultConfig.id);
    const deploymentId = getVaultDeploymentId(vaultConfig.id);

    const txOverrides = await getTxOverrides(hre);

    const state = stateStore.getById(proxyId);
    let vaultAddress: string;
    let vault: Vault;
    let freshDeployment = false;
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
      freshDeployment = true;

      await verifyContract(hre, implementationAddress, []);
      await registerInContractRegistry(signer, contractRegistry, {
        contractAddress: vaultAddress,
        contractType: ContractType.LevvaVault,
        data: '0x',
      });

      console.log(`Vault ${vaultConfig.id} deployed: ${vaultAddress}, txHash: ${txHash}\n`);
    }

    console.log(`Check connected adapters`);
    if (freshDeployment) {
      // Connect pools for fresh deployment only

      for (const marginlyPool of vaultConfig.marginlyPools) {
        const poolConfig = await configManager.getPoolConfigByAddress(vaultAddress, marginlyPool);
        if (poolConfig.pool === ZeroAddress) {
          const tx = await configManager.connect(signer).addMarginlyPool(vaultAddress, marginlyPool);
          await tx.wait();

          console.log(`MarginlyPool ${marginlyPool} connected to vault ${vaultConfig.id}`);
        }
      }
    }

    for (const adapterType of vaultConfig.adapters) {
      const adapterInfo = adapters.find((x) => x.type === adapterType);
      if (!adapterInfo) {
        throw new Error(`Adapter not found by type: ${adapterType}`);
      }

      const lendingAdapter = await vault.getLendingAdapter(adapterInfo.protocolType);
      if (lendingAdapter !== adapterInfo.adapterImpl) {
        const tx = await vault.connect(signer).addLendingAdapter(adapterInfo.protocolType, adapterInfo.adapterImpl);
        await tx.wait();

        console.log(`Set lending adapter ${adapterInfo.adapterImpl} protocolType ${adapterInfo.protocolType}`);
      }
    }

    await technicalPositionDeposit(signer, vaultConfig, underlyingToken, vault);

    const minDepositRaw = parseUnits(
      vaultConfig.minDeposit,
      Number.parseInt(underlyingToken.assertDecimals.toString())
    );

    if ((await vault.getMinDeposit()) !== minDepositRaw) {
      await vault.connect(signer).setMinDeposit(minDepositRaw);
    }
  }
}

async function deployContractRegistry(
  signer: Signer,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore
): Promise<ContractRegistry> {
  console.log(`Deploy ContractRegistry.`);

  const contractId = 'contractRegistry';
  const txOverrides = await getTxOverrides(hre);

  const state = stateStore.getById(contractId);
  let contractAddress: string;
  let contract: ContractRegistry;
  if (state !== undefined) {
    console.log(`ContractRegistry already deployed. Skip.`);
    contractAddress = state.address;
    contract = ContractRegistry__factory.connect(contractAddress, signer);
  } else {
    contract = (await new ContractRegistry__factory()
      .connect(signer)
      .deploy(txOverrides)) as unknown as ContractRegistry;
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();

    const txHash = contract.deploymentTransaction()?.hash;

    stateStore.setById(contractId, <DeployState>{ address: contractAddress, txHash });
    deploymentStore.setById(contractId, <DeploymentState>{ address: contractAddress });

    await verifyContract(hre, contractAddress, []);

    console.log(`ContractRegistry deployed: ${contractAddress}, txHash: ${txHash}`);
  }

  console.log(`\n`);

  return contract;
}

async function deployTimelock(
  signer: Signer,
  hre: HardhatRuntimeEnvironment,
  stateStore: StateStore,
  deploymentStore: DeploymentStore,
  config: TimelockConfig
) {
  console.log(`Deploy Timelock.`);

  const contractId = 'timelock';
  const txOverrides = await getTxOverrides(hre);

  const state = stateStore.getById(contractId);
  let contractAddress: string;
  let contract: TimelockWhitelist;
  if (state !== undefined) {
    console.log(`ContractRegistry already deployed. Skip.`);
    contractAddress = state.address;
    contract = TimelockWhitelist__factory.connect(contractAddress, signer);
  } else {
    contract = (await new TimelockWhitelist__factory()
      .connect(signer)
      .deploy(
        0,
        config.proposers,
        config.executors,
        hre.ethers.ZeroAddress,
        config.whitelistedTargets,
        config.whitelistedMethods,
        txOverrides
      )) as unknown as TimelockWhitelist;

    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();

    const txHash = contract.deploymentTransaction()?.hash;

    stateStore.setById(contractId, <DeployState>{ address: contractAddress, txHash });
    deploymentStore.setById(contractId, <DeploymentState>{ address: contractAddress });

    await verifyContract(hre, contractAddress, [
      0,
      config.proposers,
      config.executors,
      hre.ethers.ZeroAddress,
      config.whitelistedTargets,
      config.whitelistedMethods,
    ]);

    console.log(`Timelock deployed: ${contractAddress}, txHash: ${txHash}`);
  }

  console.log(`\n`);

  return contract;
}

export async function verifyContract(hre: HardhatRuntimeEnvironment, address: string, constructorArguments: any[]) {
  const isDryRun = hre.config.networks.hardhat.forking !== undefined;
  if (!isDryRun) {
    console.log(`Verify contract ${address} with constructor arguments: ${constructorArguments}`);
    await delay(12_000); //wait 12 seconds

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

enum ContractType {
  Nothing = 0,
  LevvaVault = 2000,
}

type RegisterContractArgs = { contractType: ContractType; contractAddress: string; data: BytesLike };

async function registerInContractRegistry(
  signer: Signer,
  contractRegistry: ContractRegistry,
  registerArgs: RegisterContractArgs
) {
  const tx = await contractRegistry
    .connect(signer)
    .registerContract(registerArgs.contractType, registerArgs.contractAddress, registerArgs.data);
  await tx.wait();
  console.log(`Contract ${registerArgs.contractAddress} registered in registry`);
}

async function technicalPositionDeposit(
  signer: Signer,
  vaultConfig: VaultConfig,
  underlyingTokenConfig: TokenConfig,
  vault: Vault
) {
  try {
    const decimals = Number.parseInt(underlyingTokenConfig.assertDecimals.toString());
    const symbol = underlyingTokenConfig.assertSymbol;
    const amountToDeposit = parseUnits(vaultConfig.technicalPositionDeposit, decimals);

    const totalSupply = await vault.totalSupply();
    if (totalSupply > 0n || amountToDeposit <= 0n) {
      console.log(`Technical position deposit into vault ${vaultConfig.id} skipped. Total supply ${totalSupply}`);
      return;
    }

    const underlyingToken = ERC20__factory.connect(underlyingTokenConfig.address, signer);
    const signerBalance = await underlyingToken.balanceOf(signer);
    if (signerBalance < amountToDeposit) {
      throw new Error(
        `Signer balance ${formatUnits(signerBalance, decimals)} ${symbol}  is less than amount to deposit ${formatUnits(amountToDeposit, decimals)} ${symbol}`
      );
    }

    console.log(`\nTechnical position deposit into vault ${vaultConfig.id}`);

    let tx = await underlyingToken.approve(vault.getAddress(), amountToDeposit);
    await tx.wait();
    console.log('Approved spending');

    tx = await vault.connect(signer).deposit(amountToDeposit, signer);
    await tx.wait();

    console.log(`Technical position deposit ${formatUnits(amountToDeposit, decimals)} ${symbol} done`);
  } catch (e) {
    console.log(`Technical position deposit into vault ${vaultConfig.id} failed:\n ${e}`);
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
