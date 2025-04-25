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
    sonic: {
      url: process.env.SONIC_RPC_URL,
    },
  },
  etherscan: {
    apiKey: {
      ethereum: process.env.API_KEY,
      arbitrum: process.env.ARBITRUM_API_KEY,
      holesky: process.env.HOLESKY_API_KEY,
      sonic: process.env.SONIC_API_KEY,
    },
    customChains: [
      {
        network: 'sonic',
        chainId: 146,
        urls: {
          apiURL: 'https://api.sonicscan.org/api',
          browserURL: 'https://sonicscan.org',
        },
      },
    ],
  },
};

export default config;
