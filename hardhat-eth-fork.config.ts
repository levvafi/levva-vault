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
        url: 'https://rpc.ankr.com/eth',
        blockNumber: 21944989,
      },
      initialBaseFeePerGas: 0,
    },
  },
};

export default config;
