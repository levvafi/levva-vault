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
  aavePool: string;
}

export interface VaultConfig {
  id: string;
  tokenId: string;
  lpName: string;
  lpSymbol: string;
  marginlyPools: string[];
}

export interface AdapterConfig {
  type: 'marginly' | 'aave' | 'etherfi';
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

  await validateConfig(config, provider, dryRun);

  return config;
}

async function validateConfig(config: DeployConfig, provider: Provider, dryRun: boolean): Promise<void> {
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
