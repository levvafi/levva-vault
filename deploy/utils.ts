import { formatEther, parseUnits } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export async function showGasUsed(hre: HardhatRuntimeEnvironment, fromBlock: number, toBlock: number) {
  let totalGasUsed = 0n;
  for (let index = fromBlock; index <= toBlock; index++) {
    const block = await hre.ethers.provider.getBlock(index);
    if (block) {
      totalGasUsed += block.gasUsed;
    }
  }
  console.log(`Total gas used for deploy ${totalGasUsed}`);
  console.log(` Deployment prices for different gas price:`);
  const gasPricesInGwei = [4, 8, 15, 25, 40];
  for (const gasPriceInGwei of gasPricesInGwei) {
    const gasPrice = parseUnits(gasPriceInGwei.toString(), 'gwei');
    console.log(`   ${gasPriceInGwei} Gwei => ${formatEther(totalGasUsed * gasPrice)} Eth`);
  }
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
