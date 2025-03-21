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
        url: 'https://arb1.arbitrum.io/rpc',
        blockNumber: 262018580,
      },
      initialBaseFeePerGas: 0,
      allowBlocksWithSameTimestamp: true,
    },
  },
};

export default config;
