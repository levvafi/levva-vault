import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect, use } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { IERC20 } from '../../../typechain-types/@openzeppelin/contracts/token/ERC20';
import { TestMarginlyLending, TestMarginlyLending__factory, IWeth9__factory } from '../../../typechain-types';
import { ArbAddressData, setTokenBalance, shiftTime } from '../../shared/utils';
import { formatEther, parseUnits, ZeroAddress } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

type MarginlyLendingTestSystem = {
  marginly: TestMarginlyLending;
  weth: IERC20;
  owner: SignerWithAddress;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
  user3: SignerWithAddress;
  connectedPools: string[];
};

async function deployMarginlyLending(): Promise<MarginlyLendingTestSystem> {
  const [owner, user1, user2, user3] = await ethers.getSigners();
  const weth = IWeth9__factory.connect(ArbAddressData.weth);

  const marginlyLending = (await upgrades.deployProxy(
    new TestMarginlyLending__factory().connect(owner),
    [ArbAddressData.weth],
    {
      initializer: 'initialize',
    }
  )) as any as TestMarginlyLending;

  const initialWethBalance = parseUnits('10', 18);
  await weth.connect(owner).deposit({ value: initialWethBalance });
  await weth.connect(user1).deposit({ value: initialWethBalance });
  await weth.connect(user2).deposit({ value: initialWethBalance });
  await weth.connect(user3).deposit({ value: initialWethBalance });

  const connectedPools = [
    ArbAddressData.marginlyOldEthUsdc,
    ArbAddressData.marginlyOldEthUsdcE,
    ArbAddressData.marginlyOldGmxEth,
    ArbAddressData.marginlyOldPendleEth,
    ArbAddressData.marginlyOldRdntEth,
    ArbAddressData.marginlyOldWbtcEth,
    ArbAddressData.marginlyOldWethLink,
  ];
  for (const pool of connectedPools) {
    await marginlyLending.connect(owner).addMarginlyPool(pool);
  }

  expect(await marginlyLending.getCountOfPools()).to.be.eq(7);

  return {
    marginly: marginlyLending,
    weth,
    connectedPools,
    owner,
    user1,
    user2,
    user3,
  };
}

async function setUsdcBalance(account: string, amount: bigint) {
  setTokenBalance(ArbAddressData.usdc, account, amount);
}

describe('Marignly', () => {
  it('deposit to 6 pools, wait and withdraw', async () => {
    const { marginly, weth, owner, user1 } = await loadFixture(deployMarginlyLending);

    await weth.connect(owner).transfer(await marginly.getAddress(), parseUnits('6', 18));

    const balanceBefore = await weth.connect(owner).balanceOf(await marginly.getAddress());

    const depositAmount = parseUnits('1', 18);
    await marginly.connect(owner).deposit(ArbAddressData.marginlyOldEthUsdc, depositAmount);
    await marginly.connect(owner).deposit(ArbAddressData.marginlyOldEthUsdcE, depositAmount);
    await marginly.connect(owner).deposit(ArbAddressData.marginlyOldGmxEth, depositAmount);
    await marginly.connect(owner).deposit(ArbAddressData.marginlyOldPendleEth, depositAmount);
    await marginly.connect(owner).deposit(ArbAddressData.marginlyOldRdntEth, depositAmount);
    await marginly.connect(owner).deposit(ArbAddressData.marginlyOldWbtcEth, depositAmount);

    shiftTime(360 * 24 * 60 * 60);

    await marginly.updateTotalLent();
    console.log(formatEther(await marginly.updateTotalLent.staticCall()));

    const withdrawAmount = parseUnits('2', 18);
    await marginly.connect(owner).withdraw(ArbAddressData.marginlyOldEthUsdc, withdrawAmount);
    await marginly.connect(owner).withdraw(ArbAddressData.marginlyOldEthUsdcE, withdrawAmount);
    await marginly.connect(owner).withdraw(ArbAddressData.marginlyOldGmxEth, withdrawAmount);
    await marginly.connect(owner).withdraw(ArbAddressData.marginlyOldPendleEth, withdrawAmount);
    await marginly.connect(owner).withdraw(ArbAddressData.marginlyOldRdntEth, withdrawAmount);
    await marginly.connect(owner).withdraw(ArbAddressData.marginlyOldWbtcEth, withdrawAmount);

    const balanceAfter = await weth.connect(owner).balanceOf(await marginly.getAddress());

    console.log(`Balance before ${formatEther(balanceBefore)} ETH`);
    console.log(`Balance after ${formatEther(balanceAfter)} ETH`);
  });

  it('deposit into uknown pool should fail', async () => {
    const { marginly, weth, owner, user1 } = await loadFixture(deployMarginlyLending);
    await weth.connect(owner).transfer(await marginly.getAddress(), parseUnits('5', 18));
  });

  it('remove marginly pool', async () => {
    const { marginly, weth, owner, user1, connectedPools } = await loadFixture(deployMarginlyLending);

    //remove at 0 index, first element changed
    let poolToRemove = await marginly.getPoolByIndex(0);
    await marginly.removeMarginlyPool(0);
    expect(await marginly.getCountOfPools()).to.be.eq(6);
    expect(await marginly.getPoolByIndex(0)).to.be.eq(connectedPools[6]);
    expect((await marginly.getPoolConfig(poolToRemove)).initialized).to.be.false;

    // remove at last index, first element not changed
    poolToRemove = await marginly.getPoolByIndex(5);
    await marginly.removeMarginlyPool(5);
    expect(await marginly.getCountOfPools()).to.be.eq(5);
    expect(await marginly.getPoolByIndex(0)).to.be.eq(connectedPools[6]);
    expect((await marginly.getPoolConfig(poolToRemove)).initialized).to.be.false;
  });

  it('remove pool should fail when vault has positions', async () => {
    const { marginly, weth, owner, user1, connectedPools } = await loadFixture(deployMarginlyLending);

    await weth.connect(owner).transfer(await marginly.getAddress(), parseUnits('5', 18));

    const depositAmount = parseUnits('1', 18);
    await marginly.connect(owner).deposit(ArbAddressData.marginlyOldEthUsdc, depositAmount);

    await expect(marginly.removeMarginlyPool(0)).to.be.revertedWithCustomError(
      marginly,
      'MarginlyHasLendPositionInPool'
    );
  });

  it('add marginly pool', async () => {
    const { marginly, weth, owner, user1 } = await loadFixture(deployMarginlyLending);
    const poolToAdd = await marginly.getPoolByIndex(0);
    await marginly.removeMarginlyPool(0);
    expect(await marginly.getCountOfPools()).to.be.eq(6);

    await marginly.addMarginlyPool(poolToAdd);
    expect(await marginly.getCountOfPools()).to.be.eq(7);
    expect(await marginly.getPoolByIndex(6)).to.be.eq(poolToAdd);
  });

  it('add marginly pool should fail when wrong asset', async () => {
    const { marginly, weth, owner, user1 } = await loadFixture(deployMarginlyLending);
    await marginly.removeMarginlyPool(0);

    const poolToAdd = ArbAddressData.marginlyOldArbUsdc;
    await expect(marginly.addMarginlyPool(poolToAdd)).to.be.revertedWithCustomError(marginly, 'MarginlyWronPool');
  });

  it('add marginly pool should fail when pool limit reached', async () => {
    const { marginly, weth, owner, user1 } = await loadFixture(deployMarginlyLending);
    const poolToAdd = ArbAddressData.marginlyPtUsde29AugUsdcPool;
    await expect(marginly.addMarginlyPool(poolToAdd)).to.be.revertedWithCustomError(
      marginly,
      'MarginlyLendingPoolsLimitReached'
    );
  });
});
