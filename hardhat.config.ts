import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import './tasks';
import * as defaultConfig from './hardhat.common';
import { configDotenv } from 'dotenv';

configDotenv();

const config = {
  ...defaultConfig.default,
  networks: {
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL,
    },
    holesky: {
      url: process.env.ETH_HOLESKY_RPC_URL,
    },
  },
};

export default config;
