import '@nomicfoundation/hardhat-toolbox';
// import 'solidity-docgen';
import './tasks/deploy';
import * as defaultConfig from './hardhat.common';

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: 'https://rpc.ankr.com/eth',
        blockNumber: 20370155,
      },
      initialBaseFeePerGas: 0,
    },
  },
};

export default config;
