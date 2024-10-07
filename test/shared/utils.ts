import { BigNumberish, BytesLike, parseEther, formatEther, parseUnits, ContractTransactionResponse } from 'ethers';
import { ethers } from 'hardhat';
import * as helpers from '@nomicfoundation/hardhat-network-helpers';
import {
  Vault,
  MarginlyAdapter,
  MarginlyAdapter__factory,
  AaveAdapter__factory,
  EtherfiAdapter__factory,
} from '../../typechain-types';

import * as gasSnapshoter from '@uniswap/snapshot-gas-cost';

export const USER_WARDEN_ADDRESS = 'warden1234';

export const WardenChain = 'warden';
export const WardenContractAddress = 'warden-cosm-wasm-address';

export enum EthAddressData {
  weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  stEth = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  wstEth = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  aEth = '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8',
  usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  aEthUsdt = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a',
  usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  aEthUsdc = '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
  aaveEthPool = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  elStrategyManager = '0x858646372CC42E1A627fcE94aa7A7033e7CF075A',
  elStrategy = '0x93c4b944D05dfe6df7645A86cd2206016c51564D',
  elDelegationManager = '0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A',
  eigenLayerOperator = '0x71C6F7Ed8C2d4925d0bAf16f6A85BB1736D412eb',
  axelarGateway = '0x4F4495243837681061C4743b74B3eEdf548D56A5',
  axelarGasService = '0x2d5d7d31F671F86C782533cc367F14109a082712',
  ethYield = '0x4DF66BCA96319C6A033cfd86c38BCDb9B3c11a72',
  aaveYieldUsdc = '0x0259044395FE54d8aFe28354Ac737EB216064cF9',
  aaveYieldUsdt = '0x0F9d2C03AD21a30746A4b4f07919e1C5F3641F35',
}

export enum ArbAddressData {
  usdc = '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  weth = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',

  aavePool = '0x794a61358D6845594F94dc1DB02A252b5b4814aD',

  marginlyOldEthUsdcE = '0x53C08A5e2b7bc973d3d5Aee60373969E30e93B93',
  marginlyOldEthUsdc = '0x87e711BcB9Ed1f2f6dec8fcC74cD2e0613D43b86',
  marginlyOldWbtcEth = '0x99Cc2A68e121F2434db5C5D63670212F07f89ee8',
  marginlyOldArbUsdc = '0x0F750fBb044037254b5843C6b4a715AA12876d94',
  marginlyOldGmxEth = '0x0637B18b5c5b7fe72F63a5511D2e90BEc7FC828E',
  marginlyOldPendleEth = '0x3adc0f25c7A23a626A67811c47d0A0DbE21773a4',
  marginlyOldRdntEth = '0x82bC6A8dA5988E66676014cA99056Bd7A2f44dF2',
  marginlyOldWethLink = '0x6e699E6eD6391259e4Cec38c16d80f772dF9F370',

  marginlyPtUsde29AugUsdcPool = '0x79C37E226834Dc6BfB04Ba0b60f823515c32f50D',
  marginlyPtezETH26SepezETH = '0x44579419E975f4d59eaA0876f2EdCA7F2531821A',
  marginlyPtweeth26sep2024weeth = '0x3ad4F88aF401bf5F4F2fE35718139cacC82410d7',
}

export const TokenBalanceStorage: Map<string, string> = new Map([
  [EthAddressData.weth.toString(), '0000000000000000000000000000000000000000000000000000000000000003'],
  [EthAddressData.usdt.toString(), '0000000000000000000000000000000000000000000000000000000000000002'],
  [EthAddressData.usdc.toString(), '0000000000000000000000000000000000000000000000000000000000000009'],
  [ArbAddressData.usdc.toString(), '0000000000000000000000000000000000000000000000000000000000000009'],
]);

function getAccountBalanceStorageSlot(account: string, tokenMappingSlot: string): string {
  if (!ethers.isAddress(account)) {
    throw new Error(`failed to get token balance: wrong address ${account}`);
  }
  return ethers.keccak256('0x' + account.slice(2).padStart(64, '0') + tokenMappingSlot);
}

export async function setTokenBalance(tokenAddress: string, account: string, newBalance: bigint) {
  if (!ethers.isAddress(account)) {
    throw new Error(`failed to set token balance: wrong address ${account}`);
  }

  const balanceOfSlotAddress = TokenBalanceStorage.get(tokenAddress);
  if (balanceOfSlotAddress === undefined) {
    throw new Error(`unknown storage slot for token ${tokenAddress}`);
  }
  const balanceOfStorageSlot = getAccountBalanceStorageSlot(account, balanceOfSlotAddress);

  await ethers.provider.send('hardhat_setStorageAt', [
    tokenAddress,
    balanceOfStorageSlot,
    ethers.zeroPadValue(toHexString(newBalance), 32),
  ]);
}

function toHexString(value: bigint): string {
  let hexString: string = value.toString(16);

  if (hexString.length % 2 !== 0) {
    hexString = '0' + hexString;
  }
  return `0x${hexString}`;
}

export async function shiftTime(seconds: number) {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
}

export enum ProtocolType {
  Marginly = 0,
  Aave = 1,
  Etherfi = 2,
}

export enum EtherfiWithdrawType {
  RequestWithdraw = 0,
  ClaimWithdraw = 1,
}

export async function logVaultState(vault: Vault, descr: string) {
  const freeAmount = await vault.getFreeAmount();
  console.log(`Vault ${descr}`);
  console.log(` freeAmount: ${formatEther(freeAmount)} ETH`);
  const totalLent = await vault.getTotalLent();
  console.log(` totalLent: ${formatEther(totalLent)} ETH`);
  const totalSupply = await vault.totalSupply();
  console.log(` Lp totalSupply: ${formatEther(totalSupply)} lvvETH`);

  const assetsPerLpUnit = await vault.convertToAssets(parseUnits('1', 18));
  console.log(` Lp price: ${formatEther(assetsPerLpUnit)} ETH`);
  console.log('\n');
}

export function encodeMarginlyDeposit(poolAddress: string, amount: bigint) {
  return MarginlyAdapter__factory.createInterface().encodeFunctionData('deposit', [poolAddress, amount]);
}

export function encodeMarginlyWithdraw(poolAddress: string, amount: bigint) {
  return MarginlyAdapter__factory.createInterface().encodeFunctionData('withdraw', [poolAddress, amount]);
}

export function encodeAaveDeposit(amount: bigint) {
  return AaveAdapter__factory.createInterface().encodeFunctionData('supply', [amount]);
}

export function encodeAaveWithdraw(amount: bigint) {
  return AaveAdapter__factory.createInterface().encodeFunctionData('withdraw', [amount]);
}

export function encodeEtherfiDeposit(amount: bigint) {
  return EtherfiAdapter__factory.createInterface().encodeFunctionData('deposit', [amount]);
}

export function encodeEtherfiRequestWithdraw(amount: bigint) {
  return EtherfiAdapter__factory.createInterface().encodeFunctionData('requestWithdraw', [amount]);
}

export function encodeEtherfiClaimWithdraw(): string {
  return EtherfiAdapter__factory.createInterface().encodeFunctionData('claimWithdraw');
}

export function encodeResult(result: bigint): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [result]);
}

export async function snapshotGasCost(ctr: Promise<ContractTransactionResponse>) {
  const txReceipt = await (await ctr).wait();
  await gasSnapshoter.default(Number(txReceipt?.gasUsed));
}
