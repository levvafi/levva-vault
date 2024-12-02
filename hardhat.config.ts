import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import './tasks';
import * as defaultConfig from './hardhat.common';

const config = {
  ...defaultConfig.default,
  networks: {
    ethereum: {
      url: 'https://ethereum-rpc.publicnode.com',
    },
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
    },
    blast: {
      url: 'https://rpc.ankr.com/blast',
    },
    holesky: {
      url: 'https://1rpc.io/holesky',
    },
  },
};

export default config;
