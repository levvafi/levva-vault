import '@nomicfoundation/hardhat-toolbox';
import './tasks';
import * as defaultConfig from './hardhat.common';
import { configDotenv } from 'dotenv';

configDotenv();

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: process.env.ETHEREUM_RPC_URL,
        blockNumber: 21888100,
      },
      initialBaseFeePerGas: 0,
    },
  },
};

export default config;
