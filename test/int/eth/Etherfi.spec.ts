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
  IWithdrawRequestNFT,
  IWithdrawRequestNFT__factory,
  ILiquidityPool,
  ILiquidityPool__factory,
  IVault,
} from '../../../typechain-types';
import { formatEther, parseUnits } from 'ethers';
import {
  ProtocolType,
  logVaultState,
  encodeEtherfiDeposit,
  encodeEtherfiRequestWithdraw,
  encodeEtherfiClaimWithdraw,
} from '../../shared/utils';

const EtherfiWeETH = '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee';
const Weth9 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const EtherfiLiquidityPoolAddress = '0x308861a430be4cce5502d0a12724771fc6daf216';
const EtherfiWithdrawRequestNFTAddress = '0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c';
const EtherfiAdminAddress = '0x0EF8fa4760Db8f5Cd4d993f3e3416f30f942D705';
const EtherfiTimelockAddress = '0x9f26d4C958fD811A1F59B01B86Be7dFFc9d20761';
const EtherfiMembershipManagerAddress = '0x3d320286E014C3e1ce99Af6d6B00f0C1D63E3000';

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
let etherfiAdmin: SignerWithAddress;
let etherfiWithdrawRequestNFTContract: IWithdrawRequestNFT;
let etherfiLiquidityPoolContract: ILiquidityPool;
let etherfiWithdrawNftOwner: SignerWithAddress;
let etherfiMembershipManager: SignerWithAddress;

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

  etherfiAdmin = await ethers.getImpersonatedSigner('0x12582A27E5e19492b4FcD194a60F8f5e1aa31B0F');
  await owner.sendTransaction({
    to: etherfiAdmin,
    value: parseUnits('1', 18),
  });

  etherfiWithdrawRequestNFTContract = IWithdrawRequestNFT__factory.connect(
    EtherfiWithdrawRequestNFTAddress,
    etherfiAdmin
  );
  etherfiLiquidityPoolContract = ILiquidityPool__factory.connect(EtherfiLiquidityPoolAddress, owner.provider);

  etherfiWithdrawNftOwner = await ethers.getImpersonatedSigner(EtherfiTimelockAddress);
  await owner.sendTransaction({
    to: etherfiWithdrawNftOwner,
    value: parseUnits('5', 18),
  });

  etherfiMembershipManager = await ethers.getImpersonatedSigner(EtherfiMembershipManagerAddress);
  await owner.sendTransaction({
    to: etherfiMembershipManager,
    value: parseUnits('1', 18),
  });
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

async function etherfiFinalize() {
  await etherfiWithdrawRequestNFTContract.connect(etherfiWithdrawNftOwner).finalizeRequests(999999);
}

async function etherfiRebase() {
  // rebase to simulate staking rewards
  let totalClaim = await etherfiLiquidityPoolContract.getTotalEtherClaimOf(await vault.getAddress());
  console.log(`Total claim ether berfore rebase ${formatEther(totalClaim)} ETH`);

  await etherfiLiquidityPoolContract.connect(etherfiMembershipManager).rebase(parseUnits('1000000', 18));

  totalClaim = await etherfiLiquidityPoolContract.getTotalEtherClaimOf(await vault.getAddress());
  console.log(`Total claim ether after rebase ${formatEther(totalClaim)} ETH`);
}

describe('Vault with etherfi adapter', () => {
  it('seed and harvest (request withdraw and claim)', async () => {
    const depositAmount = parseUnits('14', 18);

    const depositAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiDeposit(depositAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([depositAction]);
    await logVaultState(vault, 'after deposit');

    await etherfiRebase();
    await etherfiFinalize();

    await logVaultState(vault, 'after rebase and reinit');

    const requestWithdrawAmount = parseUnits('1.5', 18);
    const requestWithdrawAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiRequestWithdraw(requestWithdrawAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([requestWithdrawAction]);

    const claimWithdrawAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiClaimWithdraw(),
    };
    await vault.connect(vaultManager).executeProtocolAction([claimWithdrawAction]);

    await logVaultState(vault, 'after unstake 1.5 ETH');
  });

  it('multiple unstake requests', async () => {
    const depositAmount = parseUnits('14', 18);

    const depositAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiDeposit(depositAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([depositAction]);
    await logVaultState(vault, 'after deposit');

    await logVaultState(vault, 'after 3 unstake requests');
    await etherfiRebase();
    await etherfiFinalize();

    let totalClaim = await etherfiLiquidityPoolContract.getTotalEtherClaimOf(await vault.getAddress());
    const requestWithdrawAmount1 = parseUnits('3', 18);
    const requestWithdrawAmount2 = parseUnits('4', 18);
    const requestWithdrawAmount3 = totalClaim - requestWithdrawAmount1 - requestWithdrawAmount2;

    const requestWithdrawAction1: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiRequestWithdraw(requestWithdrawAmount1),
    };
    const requestWithdrawAction2: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiRequestWithdraw(requestWithdrawAmount2),
    };
    const requestWithdrawAction3: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiRequestWithdraw(requestWithdrawAmount3),
    };
    await vault
      .connect(vaultManager)
      .executeProtocolAction([requestWithdrawAction1, requestWithdrawAction2, requestWithdrawAction3]);

    const claimWithdrawAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiClaimWithdraw(),
    };
    await vault.connect(vaultManager).executeProtocolAction([claimWithdrawAction]);
    await logVaultState(vault, 'after first claim');

    await vault.connect(vaultManager).executeProtocolAction([claimWithdrawAction]);
    await logVaultState(vault, 'after second claim');

    await vault.connect(vaultManager).executeProtocolAction([claimWithdrawAction]);
    await logVaultState(vault, 'after third claim');

    //all users withdraw their funds
    for (const usr of [user, user2, user3]) {
      console.log(`User ${await usr.getAddress()} balance ${formatEther(await vault.balanceOf(usr))} lvvETH`);
      console.log(`Preview redeem ${formatEther(await vault.previewRedeem(await vault.balanceOf(usr)))} ETH`);
      await vault.connect(usr).redeem(await vault.balanceOf(usr), usr, usr);
    }

    await logVaultState(vault, 'after dry claim');
  });

  it('min deposit', async () => {
    const depositAmount = 10n;
    const depositAction: IVault.ProtocolActionArgStruct = {
      protocol: ProtocolType.Etherfi,
      data: encodeEtherfiDeposit(depositAmount),
    };
    await vault.connect(vaultManager).executeProtocolAction([depositAction]);
  });
});
