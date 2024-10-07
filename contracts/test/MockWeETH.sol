// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IWeETH} from '../protocols/etherfi/IWeETH.sol';

contract MockWeETH is IWeETH, IERC20 {
  address private _liquidityPool;
  address private _eETH;
  mapping(address => uint256) private _balances;
  mapping(address => mapping(address => uint256)) private _allowances;
  uint256 private _totalSupply;

  constructor(address liquidityPoolAddress, address eETHAddress) {
    _liquidityPool = liquidityPoolAddress;
    _eETH = eETHAddress;
  }

  function liquidityPool() external view override returns (address) {
    return _liquidityPool;
  }

  function eETH() external view override returns (address) {
    return _eETH;
  }

  function wrap(uint256 _eETHAmount) external override returns (uint256) {
    // Simulate wrapping by minting the same amount of weETH
    _mint(msg.sender, _eETHAmount);
    return _eETHAmount;
  }

  // IERC20 functions
  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) external view override returns (uint256) {
    return _balances[account];
  }

  function transfer(address to, uint256 amount) external override returns (bool) {
    _transfer(msg.sender, to, amount);
    return true;
  }

  function allowance(address owner, address spender) external view override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
    _spendAllowance(from, msg.sender, amount);
    _transfer(from, to, amount);
    return true;
  }

  // Internal functions
  function _mint(address account, uint256 amount) internal {
    require(account != address(0), 'ERC20: mint to the zero address');
    _totalSupply += amount;
    unchecked {
      _balances[account] += amount;
    }
    emit Transfer(address(0), account, amount);
  }

  function _transfer(address from, address to, uint256 amount) internal {
    require(from != address(0), 'ERC20: transfer from the zero address');
    require(to != address(0), 'ERC20: transfer to the zero address');
    uint256 fromBalance = _balances[from];
    require(fromBalance >= amount, 'ERC20: transfer amount exceeds balance');
    unchecked {
      _balances[from] = fromBalance - amount;
      _balances[to] += amount;
    }
    emit Transfer(from, to, amount);
  }

  function _approve(address owner, address spender, uint256 amount) internal {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');
    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  function _spendAllowance(address owner, address spender, uint256 amount) internal {
    uint256 currentAllowance = _allowances[owner][spender];
    if (currentAllowance != type(uint256).max) {
      require(currentAllowance >= amount, 'ERC20: insufficient allowance');
      unchecked {
        _approve(owner, spender, currentAllowance - amount);
      }
    }
  }
}
