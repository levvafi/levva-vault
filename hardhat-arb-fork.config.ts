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
        blockNumber: 256512600,
      },
      initialBaseFeePerGas: 0,
    },
  },
};

export default config;
