import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { IERC20 } from '../../../typechain-types/@openzeppelin/contracts/token/ERC20';
import {
  ConfigManager,
  ConfigManager__factory,
  EtherfiAdapter,
  EtherfiAdapter__factory,
  IERC20__factory,
  IWeth9,
  IWeth9__factory,
  Vault,
  Vault__factory,
  Timelock__factory,
  Timelock,
} from '../../../typechain-types';
import { parseEther, parseUnits } from 'ethers';
import { expect } from 'chai';

const EtherfiWeETH = '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee';
const Weth9 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

let weeth: IERC20;
let weth: IWeth9;
let vault: Vault;
let configManager: ConfigManager;
let owner: SignerWithAddress;
let vaultManager: SignerWithAddress;
let user: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let techPositionUser: SignerWithAddress;
let timelock: Timelock;

async function deployVaultWithEtherfiAdapter() {
  [owner, vaultManager, user, user2, user3, techPositionUser] = await ethers.getSigners();
  weth = IWeth9__factory.connect(Weth9, owner.provider);
  weeth = IERC20__factory.connect(EtherfiWeETH, owner.provider);

  configManager = (await upgrades.deployProxy(
    new ConfigManager__factory().connect(owner),
    [
      Weth9, // weth address
      EtherfiWeETH, // weETH address
    ],
    {
      initializer: 'initialize',
      redeployImplementation: 'always', // only for tests
    }
  )) as any as ConfigManager;

  vault = (await upgrades.deployProxy(
    new Vault__factory().connect(owner),
    [
      Weth9, // asset
      'Levva LP WETH', // lp name
      'lvvWETH', // lp symbol
      await configManager.getAddress(), // configManager address
    ],
    {
      initializer: 'initialize',
      unsafeAllow: ['delegatecall'],
      redeployImplementation: 'always', // only for tests
    }
  )) as any as Vault;

  await configManager.connect(owner).addVault(vault, true);

  const etherfiAdapter = (await new EtherfiAdapter__factory().connect(owner).deploy()) as any as EtherfiAdapter;

  await vault.connect(owner).addVaultManager(vaultManager.address, true);
  await vault.connect(owner).addLendingAdapter(2, etherfiAdapter);

  const minDelay = 0; // 1000 seconds
  const proposers = [owner.address, user.address, user2.address];
  const executors = [owner.address, user3.address];
  timelock = (await new Timelock__factory(owner).deploy(
    minDelay,
    proposers,
    executors,
    owner.address
  )) as any as Timelock;
}

beforeEach(async () => {
  await deployVaultWithEtherfiAdapter();

  //initialize vault with 15 eth from 3 users
  const depositAmount = parseUnits('5', 18);
  const approveAmount = parseUnits('10000', 18);
  for (const usr of [user, user2, user3]) {
    await weth.connect(usr).deposit({ value: depositAmount });
    await weth.connect(usr).approve(vault, approveAmount);
    await vault.connect(usr).deposit(depositAmount, usr);
  }

  // make special technical position
  const technicalPositionAmount = parseUnits('0.0001', 18);
  await weth.connect(techPositionUser).deposit({ value: technicalPositionAmount });
  await weth.connect(techPositionUser).approve(vault, technicalPositionAmount);
  await vault.connect(techPositionUser).deposit(technicalPositionAmount, techPositionUser);
});

describe('Timelock', () => {
  it.skip('transfer owner to timelock', async () => {
    await vault.connect(owner).transferOwnership(timelock);
    const tx = await vault.acceptOwnership.populateTransaction();
    const salt = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const predecessor = '0x0000000000000000000000000000000000000000000000000000000000000000'; //ethers.ZeroHash
    const delay = await timelock.getMinDelay();
    await timelock.connect(owner).schedule(vault, 0n, tx.data, predecessor, salt, delay);

    await timelock.connect(owner).execute(vault, 0n, tx.data, predecessor, salt);

    //set min deposit
    console.log('Initial min deposit: ', await vault.getMinDeposit());
    const setMinDepositTx = await vault.setMinDeposit.populateTransaction(parseEther('0.001'));
    await timelock.connect(owner).schedule(vault, 0n, setMinDepositTx.data, predecessor, salt, delay);
    await timelock.connect(owner).execute(vault, 0n, setMinDepositTx.data, predecessor, salt);

    console.log('Current min deposit: ', await vault.getMinDeposit());

    //set min delay
    const newMinDelay = 2 * 24 * 60 * 60; // 2 days 172800 seconds
    const updateDelayTx = await timelock.updateDelay.populateTransaction(newMinDelay);
    console.log('Initial delay is ', await timelock.getMinDelay());

    const scheduleUpdateDelayTx = await timelock
      .connect(owner)
      .schedule.populateTransaction(timelock, 0n, updateDelayTx.data, predecessor, salt, delay);
    console.log('tx data for schedule update delay: ', scheduleUpdateDelayTx.data);
    await owner.sendTransaction(scheduleUpdateDelayTx);

    await timelock.connect(owner).execute(timelock, 0n, updateDelayTx.data, predecessor, salt);
    console.log('Initial delay is ', await timelock.getMinDelay());

    //remove admin
    expect(await timelock.hasRole(await timelock.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    await timelock.revokeRole(await timelock.DEFAULT_ADMIN_ROLE(), owner.address);
    expect(await timelock.hasRole(await timelock.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.false;
  });
});
