import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import '@nomicfoundation/hardhat-verify';

import { configDotenv } from 'dotenv';

configDotenv();

export const config = {
  solidity: {
    compilers: [
      {
        version: '0.8.26',
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 4000000,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 2_000_000,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['Vault', 'ConfigManager', 'Adapter', 'ContractRegistry'],
    except: ['Mock', 'Test'],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
