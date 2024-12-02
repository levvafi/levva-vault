import { task } from 'hardhat/config';
import { ethers } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Ownable2Step__factory, TimelockWhitelist__factory } from '../typechain-types';

interface DeployArgs {
  signer: string;
}

//npx hardhat --network holesky --config hardhat.config.ts factory-transfer-ownership --signer <private-key>
task('transfer-ownership', 'Change owner to timelock')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

    const timelockAddress = '0xCF515e7cB2a636CDe81D63A37F2433100cbf982C';
    const vaultAddress = '0xe8632C0BA276B245988885A37E3B1A3CeeD0D469';
    const minDelay = 259_200; //3 days, 3 * 24 * 60 * 60

    const ownableContract = Ownable2Step__factory.connect(vaultAddress, signer);
    const timelock = TimelockWhitelist__factory.connect(timelockAddress, signer);

    await (await ownableContract.connect(signer).transferOwnership(timelockAddress)).wait();
    console.log('\nTransfer ownership from factory to timelock');

    // Timelock accept ownership
    const acceptOwnershipCallData = ownableContract.interface.encodeFunctionData('acceptOwnership');
    await (
      await timelock
        .connect(signer)
        .schedule(vaultAddress, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash, 0)
    ).wait();
    console.log('Scheduled accept ownership from factory to timelock');

    await (
      await timelock
        .connect(signer)
        .execute(vaultAddress, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash)
    ).wait();
    console.log('Executed accept ownership from factory to timelock');

    // Timelock update minDelay
    const updateMinDelay = timelock.interface.encodeFunctionData('updateDelay', [minDelay]);
    await (
      await timelock.connect(signer).schedule(timelock, 0n, updateMinDelay, ethers.ZeroHash, ethers.ZeroHash, 0)
    ).wait();
    console.log('Scheduled update minDelay from 0 to 3 days');

    await (
      await timelock.connect(signer).execute(timelock, 0n, updateMinDelay, ethers.ZeroHash, ethers.ZeroHash)
    ).wait();
    console.log('Executed update minDelay from 0 to 3 days');
  });

//npx hardhat --network holesky --config hardhat.config.ts timelock-execute --signer <private-key>
task('timelock-execute', 'Timelock schedule and execute operation')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;
    const signer = new hre.ethers.Wallet(taskArgs.signer, provider);

    const timelockAddress = '0xc71968f413bF7EDa0d11629e0Cedca0831967cD3';
    const timelock = TimelockWhitelist__factory.connect(timelockAddress, signer);

    const predecessor = ethers.ZeroHash;
    const salt = ethers.ZeroHash;

    // Timelock execute
    const target = ''; // target address pool
    const callData = ''; // calldata address
    const method = callData.slice(0, 10);
    const delay = await timelock.getMinDelay();

    const operationId = await timelock.hashOperation(target, 0n, callData, predecessor, salt);

    if (await timelock.isWhitelisted(target, method)) {
      console.log('Whitelisted method. Execute operation immediately');

      await (await timelock.execute(target, 0n, callData, predecessor, salt)).wait();
    } else if (!(await timelock.isOperation(operationId))) {
      console.log('Operation not existed. Schedule operation');

      await (await timelock.schedule(target, 0n, callData, predecessor, salt, delay)).wait();
    } else if (await timelock.isOperationDone(operationId)) {
      console.log('Operation done.');
    } else if (await timelock.isOperationReady(operationId)) {
      console.log('Operation ready for execution. Execute operation');

      await (await timelock.execute(target, 0n, callData, predecessor, salt)).wait();
    } else if (await timelock.isOperationPending(operationId)) {
      const readyTimestamp = await timelock.getTimestamp(operationId);
      console.log('Operation pending. Ready at ', new Date(Number(readyTimestamp) * 1000));
    }
  });
