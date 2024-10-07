// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {IERC4626} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {IERC20} from '@openzeppelin/contracts/interfaces/IERC4626.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {Math} from '@openzeppelin/contracts/utils/math/Math.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Errors} from '../../libraries/Errors.sol';

import {ConfigManagerStorage} from '../../base/ConfigManagerStorage.sol';
import {EtherfiAdapterConfigStorage} from './EtherfiAdapterConfigStorage.sol';
import {ILendingAdapter} from '../../interfaces/ILendingAdapter.sol';
import {ILiquidityPool} from './ILiquidityPool.sol';
import {IWithdrawRequestNFT} from './IWithdrawRequestNFT.sol';
import {IWETH9} from './IWETH9.sol';
import {IWeETH} from './IWeETH.sol';
import {IVault} from '../../interfaces/IVault.sol';

/// @title EtherfiAdapter
/// @notice Adapter for interacting with the EtherFi protocol
/// @dev Implements ILendingAdapter interface for supplying and withdrawing ETH
contract EtherfiAdapter is ILendingAdapter, ConfigManagerStorage {
  using SafeERC20 for IERC20;

  event EtherfiRequestWithdraw(uint256 requestId, uint256 amount);

  event EtherfiClaimWithdraw(uint256 requestId, uint256 amount);

  /// @notice Deposit ETH into EtherFi Liquidity Pool
  /// @return Actual amount of ETH staked
  function deposit(uint256 amount) external returns (uint256) {
    EtherfiAdapterConfigStorage configStorage = EtherfiAdapterConfigStorage(_getConfigManager());
    // unwrap WETH to ETH
    IWETH9(configStorage.getWeth9()).withdraw(amount);
    IWeETH weeth = IWeETH(configStorage.getWeETH());
    ILiquidityPool liquidityPool = ILiquidityPool(weeth.liquidityPool());
    /*uint256 eETHAmount = */ liquidityPool.deposit{value: amount}();
    return amount;
  }

  /// @notice Request unstaking eETH
  /// @param amount Amount of ETH to unstake
  function requestWithdraw(uint256 amount) external returns (uint256) {
    EtherfiAdapterConfigStorage configStorage = EtherfiAdapterConfigStorage(_getConfigManager());
    IWeETH weeth = IWeETH(configStorage.getWeETH());
    IERC20 eETH = IERC20(weeth.eETH());
    ILiquidityPool liquidityPool = ILiquidityPool(weeth.liquidityPool());
    eETH.approve(address(liquidityPool), type(uint256).max);
    uint256 requestId = liquidityPool.requestWithdraw(address(this), amount);
    configStorage.enqueueUnstakeRequest(requestId, amount);

    emit EtherfiRequestWithdraw(requestId, amount);

    return 0;
  }

  /// @notice Claim withdrawn ETH from unstaking request
  /// @return Amount of ETH claimed
  function claimWithdraw() external returns (uint256) {
    EtherfiAdapterConfigStorage configStorage = EtherfiAdapterConfigStorage(_getConfigManager());
    IWeETH weeth = IWeETH(configStorage.getWeETH());
    ILiquidityPool liquidityPool = ILiquidityPool(weeth.liquidityPool());

    uint256 requestId = configStorage.peekUnstakeRequestId(address(this));
    if (requestId == 0) {
      revert Errors.NoUnstakeRequest();
    }

    IWithdrawRequestNFT withdrawRequestNFT = IWithdrawRequestNFT(liquidityPool.withdrawRequestNFT());
    if (!withdrawRequestNFT.isFinalized(requestId) || !withdrawRequestNFT.isValid(requestId)) {
      revert Errors.InvalidWithdrawRequest();
    }

    uint256 withdrawn = address(this).balance;
    withdrawRequestNFT.claimWithdraw(requestId);
    configStorage.dequeueUnstakeRequest();

    withdrawn = address(this).balance - withdrawn;
    // wrap eth to weth
    IWETH9(configStorage.getWeth9()).deposit{value: withdrawn}();

    emit EtherfiClaimWithdraw(requestId, withdrawn);

    return withdrawn;
  }

  /// @notice Update and return the total amount of ETH lent
  /// @dev Here we use sum of staked ETH and pending withdrawals from etherfi
  /// @return Total amount of ETH lent
  function updateLentAmount() external view override returns (uint256) {
    return getLentAmount(address(this));
  }

  function getLentAmount(address vault) public view returns (uint256) {
    address configManager = IVault(vault).getConfigManager();
    EtherfiAdapterConfigStorage configStorage = EtherfiAdapterConfigStorage(configManager);
    ILiquidityPool liquidityPool = ILiquidityPool(IWeETH(configStorage.getWeETH()).liquidityPool());
    uint256 pendingWithdrawals = EtherfiAdapterConfigStorage(configManager).getPendingWithdrawals(vault);
    return ILiquidityPool(liquidityPool).getTotalEtherClaimOf(vault) + pendingWithdrawals;
  }
}
