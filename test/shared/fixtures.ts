import { ethers, upgrades } from 'hardhat';
import {
  AaveAdapter,
  AaveAdapter__factory,
  ConfigManager,
  ConfigManager__factory,
  EtherfiAdapter,
  EtherfiAdapter__factory,
  MarginlyAdapter,
  MarginlyAdapter__factory,
  MintableERC20,
  MintableERC20__factory,
  MockAavePool,
  MockAavePool__factory,
  MockeETH,
  MockeETH__factory,
  MockEtherfiLiquidityPool,
  MockEtherfiLiquidityPool__factory,
  MockEtherfiWithdrawRequestNFT,
  MockEtherfiWithdrawRequestNFT__factory,
  MockMarginlyPool,
  MockMarginlyPool__factory,
  MockWeETH,
  MockWeETH__factory,
  Vault,
  Vault__factory,
  MockWETH,
  MockWETH__factory,
} from '../../typechain-types';
import { Addressable, formatUnits, parseUnits, ZeroAddress } from 'ethers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ProtocolType } from './utils';

export async function deployTestToken(symbol: string): Promise<MintableERC20> {
  const [owner] = await ethers.getSigners();
  return new MintableERC20__factory().connect(owner).deploy('test token' + symbol, symbol);
}

export async function deployWETH(): Promise<MockWETH> {
  const [owner] = await ethers.getSigners();
  return new MockWETH__factory().connect(owner).deploy();
}

export async function deployMockMarginlyPool(
  baseToken: Addressable,
  quoteToken: Addressable
): Promise<MockMarginlyPool> {
  const [owner] = await ethers.getSigners();
  return new MockMarginlyPool__factory().connect(owner).deploy(baseToken, quoteToken);
}

export async function deployMockAavePool(): Promise<MockAavePool> {
  const [owner] = await ethers.getSigners();
  return new MockAavePool__factory().connect(owner).deploy();
}

type EtherfiMock = {
  liquidityPool: MockEtherfiLiquidityPool;
  eETH: MockeETH;
  weETH: MockWeETH;
  withdrawRequestNFT: MockEtherfiWithdrawRequestNFT;
};

export async function deployMockEtherFi(): Promise<EtherfiMock> {
  const [owner] = await ethers.getSigners();
  const eETH = (await new MockeETH__factory().connect(owner).deploy()) as any as MockeETH;

  const withdrawRequestNFT = (await new MockEtherfiWithdrawRequestNFT__factory()
    .connect(owner)
    .deploy()) as any as MockEtherfiWithdrawRequestNFT;

  const liquidityPool = (await new MockEtherfiLiquidityPool__factory()
    .connect(owner)
    .deploy(eETH, withdrawRequestNFT)) as any as MockEtherfiLiquidityPool;

  await withdrawRequestNFT.setLiquidityPool(liquidityPool, eETH);

  const weETH = (await new MockWeETH__factory().connect(owner).deploy(liquidityPool, eETH)) as any as MockWeETH;

  return {
    liquidityPool,
    eETH,
    weETH,
    withdrawRequestNFT,
  };
}

export async function setUserBalance(token: MintableERC20, user: Addressable, amount: bigint): Promise<void> {
  const [owner] = await ethers.getSigners();
  await token.connect(owner).mint(user, amount);
}

type TestSystem = {
  vault: Vault;
  configManager: ConfigManager;
  aaveAdapter: AaveAdapter;
  marginlyAdapter: MarginlyAdapter;
  etherfiAdapter: EtherfiAdapter;
  owner: SignerWithAddress;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
  user3: SignerWithAddress;
  tokens: MintableERC20[];
  usdc: MintableERC20;
  weth: MockWETH;
  marginlyPools: MockMarginlyPool[];
  aavePool: MockAavePool;
  etherFi: EtherfiMock;
};

export async function deployTestSystemWithWETH(): Promise<TestSystem> {
  const [owner, user1, user2, user3] = await ethers.getSigners();

  const testUsdc = await deployTestToken('tUSDC');
  const testDai = await deployTestToken('tDAI');
  const testGmx = await deployTestToken('tGMX');
  const testArb = await deployTestToken('tARB');
  const testWeth = await deployTestToken('tWETH');
  const testLink = await deployTestToken('tLINK');
  const testRdnt = await deployTestToken('tRDNT');
  const testPendle = await deployTestToken('tPENDLE');

  const weth = await deployWETH();

  const tokens = [testUsdc, testDai, testGmx, testArb, testWeth, testLink, testRdnt, testPendle];

  for (const user of [owner, user1, user2, user3]) {
    for (const token of tokens) {
      setUserBalance(token, user, parseUnits('10000', 18));
    }
  }

  const marginlyPools = [
    await deployMockMarginlyPool(testDai, weth),
    await deployMockMarginlyPool(testUsdc, weth),
    await deployMockMarginlyPool(testGmx, weth),
    await deployMockMarginlyPool(testArb, weth),
    await deployMockMarginlyPool(testWeth, weth),
    await deployMockMarginlyPool(testLink, weth),
    await deployMockMarginlyPool(testRdnt, weth),

    await deployMockMarginlyPool(testPendle, testUsdc),
    await deployMockMarginlyPool(testGmx, testDai),
  ];

  const aavePool = await deployMockAavePool();
  const etherFi = await deployMockEtherFi();

  const configManager = (await upgrades.deployProxy(
    new ConfigManager__factory().connect(owner),
    [await weth.getAddress(), await etherFi.weETH.getAddress()],
    {
      initializer: 'initialize',
    }
  )) as any as ConfigManager;

  const vault = (await upgrades.deployProxy(
    new Vault__factory().connect(owner),
    [
      await weth.getAddress(), // asset
      'Levva LP ' + (await weth.symbol()), // lp name
      'lvv' + (await weth.symbol()), // lp symbol
      await configManager.getAddress(), // configManager address
    ],
    {
      initializer: 'initialize',
      unsafeAllow: ['delegatecall'],
    }
  )) as any as Vault;

  await configManager.connect(owner).addVault(vault, true);

  const aaveAdapter = (await new AaveAdapter__factory().connect(owner).deploy()) as any as AaveAdapter;
  const marginlyAdapter = (await new MarginlyAdapter__factory().connect(owner).deploy()) as any as MarginlyAdapter;
  const etherfiAdapter = (await new EtherfiAdapter__factory().connect(owner).deploy()) as any as EtherfiAdapter;

  return {
    vault,
    configManager,
    owner,
    user1,
    user2,
    user3,
    tokens,
    weth,
    usdc: testUsdc,
    marginlyPools,
    aaveAdapter,
    marginlyAdapter,
    etherfiAdapter,
    aavePool,
    etherFi,
  };
}

export async function deployTestSystem(): Promise<TestSystem> {
  const [owner, user1, user2, user3] = await ethers.getSigners();

  const testUsdc = await deployTestToken('tUSDC');
  const testDai = await deployTestToken('tDAI');
  const testGmx = await deployTestToken('tGMX');
  const testArb = await deployTestToken('tARB');
  const testWeth = await deployTestToken('tWETH');
  const testLink = await deployTestToken('tLINK');
  const testRdnt = await deployTestToken('tRDNT');
  const testPendle = await deployTestToken('tPENDLE');

  const weth = await deployWETH();

  const tokens = [testUsdc, testDai, testGmx, testArb, testWeth, testLink, testRdnt, testPendle];

  for (const user of [owner, user1, user2, user3]) {
    for (const token of tokens) {
      setUserBalance(token, user, parseUnits('10000', 18));
    }
  }

  const marginlyPools = [
    await deployMockMarginlyPool(testDai, testUsdc),
    await deployMockMarginlyPool(testUsdc, testWeth), // pool when usdc is base token
    await deployMockMarginlyPool(testGmx, testUsdc),
    await deployMockMarginlyPool(testArb, testUsdc),
    await deployMockMarginlyPool(testWeth, testUsdc),
    await deployMockMarginlyPool(testLink, testUsdc),
    await deployMockMarginlyPool(testRdnt, testUsdc),

    await deployMockMarginlyPool(testPendle, testUsdc),
    await deployMockMarginlyPool(testGmx, testDai),
  ];

  const aavePool = await deployMockAavePool();
  const etherFi = await deployMockEtherFi();

  const configManager = (await upgrades.deployProxy(
    new ConfigManager__factory().connect(owner),
    [await weth.getAddress(), await etherFi.weETH.getAddress()],
    {
      initializer: 'initialize',
    }
  )) as any as ConfigManager;

  const vault = (await upgrades.deployProxy(
    new Vault__factory().connect(owner),
    [
      await testUsdc.getAddress(), // asset
      'Levva LP ' + (await testUsdc.symbol()), // lp name
      'lvv' + (await testUsdc.symbol()), // lp symbol
      await configManager.getAddress(), // configManager address
    ],
    {
      initializer: 'initialize',
      unsafeAllow: ['delegatecall'],
    }
  )) as any as Vault;

  const aaveAdapter = (await new AaveAdapter__factory().connect(owner).deploy()) as any as AaveAdapter;
  const marginlyAdapter = (await new MarginlyAdapter__factory().connect(owner).deploy()) as any as MarginlyAdapter;
  const etherfiAdapter = (await new EtherfiAdapter__factory().connect(owner).deploy()) as any as EtherfiAdapter;

  return {
    vault,
    configManager,
    owner,
    user1,
    user2,
    user3,
    tokens,
    weth,
    usdc: testUsdc,
    marginlyPools,
    aaveAdapter,
    marginlyAdapter,
    etherfiAdapter,
    aavePool,
    etherFi,
  };
}

type TestSystemConfigured = {
  vault: Vault;
  configManager: ConfigManager;
  aaveAdapter: AaveAdapter;
  marginlyAdapter: MarginlyAdapter;
  etherfiAdapter: EtherfiAdapter;
  owner: SignerWithAddress;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
  user3: SignerWithAddress;
  tokens: MintableERC20[];
  usdc: MintableERC20;
  weth: MockWETH;
  marginlyPools: MockMarginlyPool[];
  connectedMarginlyPools: MockMarginlyPool[];
  aavePool: MockAavePool;
  etherFi: EtherfiMock;
};

export async function deployTestSystemWithConfiguredVault(): Promise<TestSystemConfigured> {
  const ts = await deployTestSystem();

  await ts.vault.connect(ts.owner).addLendingAdapter(ProtocolType.Marginly, ts.marginlyAdapter);
  await ts.vault.connect(ts.owner).addLendingAdapter(ProtocolType.Aave, ts.aaveAdapter);
  await ts.vault.connect(ts.owner).addLendingAdapter(ProtocolType.Etherfi, ts.etherfiAdapter);

  await ts.vault.connect(ts.owner).addVaultManager(ts.user1.address, true);

  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[0]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[1]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[2]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[3]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[4]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[5]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[6]);

  await ts.configManager.connect(ts.owner).setAavePool(ts.aavePool);

  return {
    ...ts,
    connectedMarginlyPools: ts.marginlyPools.slice(0, 6),
  };
}

export async function deployTestSystemWithConfiguredWethVault(): Promise<TestSystemConfigured> {
  const ts = await deployTestSystemWithWETH();

  await ts.vault.connect(ts.owner).addLendingAdapter(ProtocolType.Marginly, ts.marginlyAdapter);
  await ts.vault.connect(ts.owner).addLendingAdapter(ProtocolType.Aave, ts.aaveAdapter);
  await ts.vault.connect(ts.owner).addLendingAdapter(ProtocolType.Etherfi, ts.etherfiAdapter);

  await ts.vault.connect(ts.owner).addVaultManager(ts.user1.address, true);

  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[0]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[1]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[2]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[3]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[4]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[5]);
  await ts.configManager.connect(ts.owner).addMarginlyPool(ts.vault, ts.marginlyPools[6]);

  await ts.configManager.connect(ts.owner).setAavePool(ts.aavePool);

  return {
    ...ts,
    connectedMarginlyPools: ts.marginlyPools.slice(0, 6),
  };
}
