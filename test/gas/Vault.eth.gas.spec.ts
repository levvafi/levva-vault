import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { IERC20 } from '../../typechain-types/@openzeppelin/contracts/token/ERC20';
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
  IMarginlyPool,
  IMarginlyPool__factory,
  MarginlyAdapter,
  AaveAdapter,
  MarginlyAdapter__factory,
  AaveAdapter__factory,
} from '../../typechain-types';
import { formatEther, parseEther, parseUnits } from 'ethers';
import {
  ProtocolType,
  logVaultState,
  encodeEtherfiDeposit,
  encodeEtherfiRequestWithdraw,
  encodeEtherfiClaimWithdraw,
  snapshotGasCost,
  encodeMarginlyDeposit,
  encodeAaveDeposit,
} from '../shared/utils';

const EtherfiWeETH = '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee';
const Weth9 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const EtherfiLiquidityPoolAddress = '0x308861a430be4cce5502d0a12724771fc6daf216';
const EtherfiWithdrawRequestNFTAddress = '0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c';
const EtherfiAdminAddress = '0x0EF8fa4760Db8f5Cd4d993f3e3416f30f942D705';
const EtherfiTimelockAddress = '0x9f26d4C958fD811A1F59B01B86Be7dFFc9d20761';
const EtherfiMembershipManagerAddress = '0x3d320286E014C3e1ce99Af6d6B00f0C1D63E3000';

const marginlyPool_PtWeeth26Dec2024_WETH_Address = '0xa77C2275C1F403056c7F73B44df69E374C299dd7';

const aavePoolAddressProviderAddress = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e';

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
let marginlyPool_PtWeeth26Dec2024_WETH: IMarginlyPool;

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

  const marginlyAdapter = (await new MarginlyAdapter__factory().connect(owner).deploy()) as any as MarginlyAdapter;
  const etherfiAdapter = (await new EtherfiAdapter__factory().connect(owner).deploy()) as any as EtherfiAdapter;
  const aaveAdapter = (await new AaveAdapter__factory().connect(owner).deploy()) as any as AaveAdapter;

  await vault.connect(owner).addVaultManager(vaultManager.address, true);
  await vault.connect(owner).addLendingAdapter(ProtocolType.Etherfi, etherfiAdapter);
  await vault.connect(owner).addLendingAdapter(ProtocolType.Marginly, marginlyAdapter);
  await vault.connect(owner).addLendingAdapter(ProtocolType.Aave, aaveAdapter);

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

  marginlyPool_PtWeeth26Dec2024_WETH = IMarginlyPool__factory.connect(
    marginlyPool_PtWeeth26Dec2024_WETH_Address,
    owner.provider
  );

  await configManager.connect(owner).addMarginlyPool(vault, marginlyPool_PtWeeth26Dec2024_WETH);
  await configManager.connect(owner).setAavePoolAddressProvider(aavePoolAddressProviderAddress);
}

async function initVault() {
  await deployVaultWithEtherfiAdapter();

  //initialize vault with 15 eth from 3 users
  const depositAmount = parseEther('5');
  const toWethAmount = parseEther('10');
  const approveAmount = parseEther('10000');
  for (const usr of [user, user2, user3]) {
    await weth.connect(usr).deposit({ value: toWethAmount });
    await weth.connect(usr).approve(vault, approveAmount);
    await vault.connect(usr).deposit(depositAmount, usr);
  }

  // make special technical position
  const technicalPositionAmount = parseUnits('0.0001', 18);
  await weth.connect(techPositionUser).deposit({ value: technicalPositionAmount });
  await weth.connect(techPositionUser).approve(vault, technicalPositionAmount);
  await vault.connect(techPositionUser).deposit(technicalPositionAmount, techPositionUser);
}

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

describe('Vault.Eth', () => {
  describe('Etherfi', async () => {
    before(async () => {
      await initVault();
    });

    it('userDeposit empty vault', async () => {
      const depositAmount = parseEther('1');
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('executeProtocolAction.Deposit', async () => {
      // deposit 1 eth to EtherFi
      const depositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(parseEther('1')),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([depositAction]));
    });

    it('executeProtocolAction.RequestWithdraw', async () => {
      const withdrawAmount = parseEther('0.5');
      const withdrawAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiRequestWithdraw(withdrawAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([withdrawAction]));
    });

    it('executeProtocolAction.ClaimWithdraw', async () => {
      await etherfiFinalize();

      const withdrawAmount = parseEther('0.5');
      const withdrawAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiRequestWithdraw(withdrawAmount),
      };
      await snapshotGasCost(vault.connect(vaultManager).executeProtocolAction([withdrawAction]));
    });

    it('userDeposit', async () => {
      const depositAmount = parseEther('2');
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('userWithdraw', async () => {
      const withdrawAmount = parseEther('1.5');
      await snapshotGasCost(vault.connect(user2).withdraw(withdrawAmount, user2, user2));
    });
  });

  describe('Marginly1 Aave EtherFi', async () => {
    before(async () => {
      await initVault();
    });

    it('userDeposit empty vault', async () => {
      const depositAmount = parseEther('1');
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('executeProtocolAction.BatchDeposit', async () => {
      // deposit 1 eth to EtherFi
      const etherFiDepositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Etherfi,
        data: encodeEtherfiDeposit(parseEther('1')),
      };

      const marginlyDepositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Marginly,
        data: encodeMarginlyDeposit(marginlyPool_PtWeeth26Dec2024_WETH_Address, parseEther('1')),
      };

      const aaveDepositAction: IVault.ProtocolActionArgStruct = {
        protocol: ProtocolType.Aave,
        data: encodeAaveDeposit(parseEther('1')),
      };

      await snapshotGasCost(
        vault
          .connect(vaultManager)
          .executeProtocolAction([etherFiDepositAction, marginlyDepositAction, aaveDepositAction])
      );
    });

    it('userDeposit', async () => {
      const depositAmount = parseEther('2');
      await snapshotGasCost(vault.connect(user2).deposit(depositAmount, user2));
    });

    it('userWithdraw', async () => {
      const withdrawAmount = parseEther('1.5');
      await snapshotGasCost(vault.connect(user2).withdraw(withdrawAmount, user2, user2));
    });
  });
});
