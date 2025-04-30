import '@nomicfoundation/hardhat-toolbox';
import './tasks';
import * as defaultConfig from './hardhat.common';
import { configDotenv } from 'dotenv';
import { HardhatConfig } from 'hardhat/types';

configDotenv();

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: process.env.ETHEREUM_RPC_URL,
        blockNumber: 22382220,
      },
      initialBaseFeePerGas: 0,
    },
  },
};

export default config;
