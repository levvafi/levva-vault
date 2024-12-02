import path from 'path';
import fs from 'fs';
import { isAddress, Provider } from 'ethers';

import { ERC20__factory } from '../typechain-types';

export interface DeployConfig {
  ethConnection: EthConnectionConfig;
  tokens: TokenConfig[];
  configurationManager: ConfigurationManagerConfig;
  adapters: AdapterConfig[];
  vaults: VaultConfig[];
}

export interface EthConnectionConfig {
  chainId: number;
  ethOptions: Record<string, unknown>;
}

export interface TokenConfig {
  id: string;
  address: string;
  assertSymbol: string;
  assertDecimals: number;
}

export interface ConfigurationManagerConfig {
  weth9: string;
  weeth: string;
  aavePoolAddressProvider: string;
}

export interface VaultConfig {
  id: string;
  tokenId: string;
  lpName: string;
  lpSymbol: string;
  marginlyPools: string[];
  minDeposit: string; // min deposit, human like, e.g. "0.001"
  technicalPositionDeposit: string; // technical position deposit, human like, e.g. "0.001"
  adapters: AdapterType[]; // vault connected adapters
}

export interface TimelockConfig {
  proposers: string[];
  executors: string[];
  whitelistedTargets: string[];
  whitelistedMethods: string[];
}

export type AdapterType = 'marginly' | 'aave' | 'etherfi';

export interface AdapterConfig {
  type: AdapterType;
}

export function isMarginlyAdapter(adapter: AdapterConfig): adapter is AdapterConfig {
  return adapter.type === 'marginly';
}

export function isAaveAdapter(adapter: AdapterConfig): adapter is AdapterConfig {
  return adapter.type === 'aave';
}

export function isEtherfiAdapter(adapter: AdapterConfig): adapter is AdapterConfig {
  return adapter.type === 'etherfi';
}

export interface UpgradeConfig {
  ethConnection: EthConnectionConfig;
  vaults: VaultUpgradeArgs[];
  configurationManager: ConfigurationManagerUpgradeArgs;
}

export interface VaultUpgradeArgs {
  id: string;
  call?: {
    fn: string;
    args: any[];
  };
}

export interface ConfigurationManagerUpgradeArgs {
  call?: {
    fn: string;
    args: any[];
  };
}

export async function loadDeployConfig(network: string, provider: Provider, dryRun: boolean): Promise<DeployConfig> {
  const configDir = path.join(__dirname, `data`, `configs`, network);

  if (!fs.existsSync(configDir)) {
    throw new Error(`Directory '${configDir}' does not exists`);
  }
  if (!fs.statSync(configDir).isDirectory()) {
    throw new Error(`Specified '${configDir}' is not a directory`);
  }
  const configFilename = path.join(configDir, 'config.json');
  if (!fs.existsSync(configFilename)) {
    throw new Error(`Deploy config is not exist! Filename: ${configFilename}`);
  }
  const config: DeployConfig = JSON.parse(fs.readFileSync(configFilename, 'utf-8'));

  await validateDeployConfig(config, provider, dryRun);

  return config;
}

async function validateDeployConfig(config: DeployConfig, provider: Provider, dryRun: boolean): Promise<void> {
  const tokens = config.tokens;
  for (const token of tokens) {
    await assertTokenConfig(token, provider);
  }
}

async function assertTokenConfig(token: TokenConfig, provider: Provider): Promise<void> {
  if (!isAddress(token.address)) {
    throw new Error(`Invalid token address! Address: "${token.address}", symbol: ${token.assertSymbol}`);
  }
  const tokenContract = ERC20__factory.connect(token.address, provider);
  const symbol = await tokenContract.symbol();
  if (symbol !== token.assertSymbol) {
    throw new Error(
      `Invalid token symbol! Address: ${token.address}, expected symbol: ${token.assertSymbol}, actual: ${symbol}`
    );
  }
  const decimals = await tokenContract.decimals();
  if (Number(decimals) !== Number(token.assertDecimals)) {
    throw new Error(
      `Invalid token decimals! Address: ${token.address}, expected decimals: ${token.assertDecimals}, actual: ${decimals}`
    );
  }
}

export async function loadUpgradeConfig(network: string, provider: Provider, dryRun: boolean): Promise<UpgradeConfig> {
  const configDir = path.join(__dirname, `data`, `configs`, network);

  if (!fs.existsSync(configDir)) {
    throw new Error(`Directory '${configDir}' does not exists`);
  }
  if (!fs.statSync(configDir).isDirectory()) {
    throw new Error(`Specified '${configDir}' is not a directory`);
  }
  const configFilename = path.join(configDir, 'upgrade-config.json');
  if (!fs.existsSync(configFilename)) {
    throw new Error(`Deploy config is not exist! Filename: ${configFilename}`);
  }
  const config: UpgradeConfig = JSON.parse(fs.readFileSync(configFilename, 'utf-8'));
  await validateUpgadeConfig(config, provider, dryRun);

  return config;
}

async function validateUpgadeConfig(config: UpgradeConfig, provider: Provider, dryRun: boolean): Promise<void> {
  const vaultUpgradeArgs = config.vaults;
  for (const vaultUpgradeArg of vaultUpgradeArgs) {
    await validateVaultUpgradeArg(vaultUpgradeArg, provider);
  }

  if (config.configurationManager) {
    await validateConfigurationManagerUpgradeArg(config.configurationManager, provider);
  }
}

async function validateVaultUpgradeArg(upgradeArg: VaultUpgradeArgs, provider: Provider): Promise<void> {}

async function validateConfigurationManagerUpgradeArg(
  upgradeArg: ConfigurationManagerUpgradeArgs,
  provider: Provider
): Promise<void> {}
