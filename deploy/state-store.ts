import fs from 'fs';
import { Logger } from './logger';

export interface StateStore {
  getById: (id: string) => DeployState | undefined;
  setById: (id: string, deployState: DeployState) => void;
  stringify: () => string;
}

export interface DeployState {
  address: string;
  txHash?: string;
}

export interface BaseState {
  contracts: {
    [id: string]: DeployState;
  };
}

export function createDefaultBaseState(): BaseState {
  return { contracts: {} };
}

export class StateFile<TState extends BaseState> {
  private readonly stateName: string;
  private readonly createDefaultState: () => TState;
  private readonly fileName: string;
  private readonly writeToFile: boolean;
  private readonly logger: Logger;

  constructor(name: string, createDefaultState: () => TState, fileName: string, writeToFile: boolean, logger: Logger) {
    this.stateName = name;
    this.createDefaultState = createDefaultState;
    this.fileName = fileName;
    this.writeToFile = writeToFile;
    this.logger = logger;
  }

  public getStateFromFile(): TState {
    if (fs.existsSync(this.fileName)) {
      return JSON.parse(fs.readFileSync(this.fileName, 'utf-8'));
    } else {
      this.logger.log(`${this.stateName} state file not found, a new one will created`);
    }

    return this.createDefaultState();
  }

  public saveStateFileChanges(state: TState) {
    const s = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.fileName, s, { encoding: 'utf8' });
  }

  public createStateStore(): StateStore {
    const state = this.getStateFromFile();
    return {
      getById: (id: string): DeployState | undefined => {
        return state.contracts[id];
      },
      setById: (id: string, deployState: DeployState) => {
        state.contracts[id] = deployState;
        if (this.writeToFile) {
          this.saveStateFileChanges(state);
        }
      },
      stringify: (): string => {
        return JSON.stringify(state.contracts, null, 2);
      },
    };
  }
}
