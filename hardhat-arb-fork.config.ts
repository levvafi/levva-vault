import '@nomicfoundation/hardhat-toolbox';
import './tasks';
import * as defaultConfig from './hardhat.common';

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: 'https://rpc.ankr.com/arbitrum',
        blockNumber: 262018580,
      },
      initialBaseFeePerGas: 0,
      allowBlocksWithSameTimestamp: true,
    },
  },
};

export default config;
