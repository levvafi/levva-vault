import { prompts } from 'prompts';
import { task } from 'hardhat/config';
import { ConfigurableTaskDefinition, HardhatRuntimeEnvironment } from 'hardhat/types';
import { ethers, formatEther, parseEther, Signer } from 'ethers';
import * as fs from 'fs';
import { showGasUsed } from '../deploy/utils';

export interface SignerArgs {
  privateKey?: string;
  keystore?: string;
  keystorePassword?: string;
}

export interface DeployArgs extends SignerArgs {
  networkName: string;
  impersonateSigner?: string;
}

export const taskWithSigner = (name: string, description?: string): ConfigurableTaskDefinition =>
  task(name, description)
    .addOptionalParam<string>('privateKey', 'Private key of contracts creator')
    .addOptionalParam<string>('keystore', 'Keystore file path')
    .addOptionalParam<string>('keystorePassword', 'Keystore file password');

export const deployTask = (name: string, description?: string): ConfigurableTaskDefinition =>
  taskWithSigner(name, description)
    .addParam<string>('networkName', 'Network name')
    .addOptionalParam<string>('impersonateSigner', 'Impersonate address for dry-run');

const readSensitiveData = async (label: string): Promise<string> => {
  const response = await prompts.invisible({
    type: 'invisible',
    name: 'result',
    message: label,
  });
  return response as string;
};

export async function getSigner(taskArgs: SignerArgs, provider?: ethers.Provider | null): Promise<ethers.Wallet> {
  let signer: ethers.Wallet;

  if (taskArgs.privateKey) {
    console.warn('\n!!! Using private key in plain text is not recommended\n');

    signer = new ethers.Wallet(taskArgs.privateKey);
  } else if (taskArgs.keystore) {
    let keystorePassword = '';

    if (taskArgs.keystorePassword) {
      console.warn('\n!!! Use interactive mode to enter keystore password\n');

      keystorePassword = taskArgs.keystorePassword;
    } else {
      keystorePassword = await readSensitiveData('Enter keystore password');
    }
    const jsonKeystore = fs.readFileSync(taskArgs.keystore, 'utf8');

    const wallet = ethers.Wallet.fromEncryptedJsonSync(jsonKeystore, keystorePassword) as ethers.Wallet;
    if (!wallet) {
      throw new Error('Could not create wallet from keystore');
    }

    signer = provider ? wallet.connect(provider) : wallet;
  } else {
    const privateKey = await readSensitiveData('Enter signer private key');
    signer = new ethers.Wallet(privateKey, provider);
  }

  return signer;
}

export async function beforeDeploy(taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) {
  const provider = hre.ethers.provider;
  const startBlockNumber = await provider.getBlockNumber();

  let signer: Signer;
  let dryRun = false;

  if (taskArgs.impersonateSigner) {
    //dry-run mode, impersonate address
    dryRun = true;
    console.log(`Dry run command on fork`);
    console.log(`Impersonating signer: ${taskArgs.impersonateSigner}`);

    signer = await hre.ethers.getImpersonatedSigner(taskArgs.impersonateSigner);

    console.log('Funding signer');
    const [user] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();
    await user.sendTransaction({
      to: signerAddress,
      value: parseEther('1.0'),
    });
    console.log(`Sent 1 ETH to deployer${signerAddress}`);
  } else {
    signer = await getSigner(taskArgs, provider);
  }

  const network = taskArgs.networkName.toLowerCase();
  if (!dryRun && hre.network.name.toLowerCase() !== network) {
    throw new Error(`The network from the config and from CLI "--network" must be same!`);
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
