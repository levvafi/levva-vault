import { Logger } from './logger';
import fs from 'fs';

export interface DeploymentStore {
  getById: (id: string) => DeploymentState | undefined;
  setById: (id: string, deploymentState: DeploymentState) => void;
  stringify: () => string;
}

export interface DeploymentState {
  address: string;
  implementation?: string;
}

export interface BaseDeployment {
  [id: string]: DeploymentState;
}

export function createDefaultBaseDeployment(): BaseDeployment {
  return {};
}

export class DeploymentFile<TDeployment extends BaseDeployment> {
  private readonly deploymentName: string;
  private readonly createDefaultDeployment: () => TDeployment;
  private readonly fileName: string;
  private readonly writeToFile: boolean;
  private readonly logger: Logger;

  constructor(
    name: string,
    createDefaultDeployment: () => TDeployment,
    fileName: string,
    writeToFile: boolean,
    logger: Logger
  ) {
    this.deploymentName = name;
    this.createDefaultDeployment = createDefaultDeployment;
    this.fileName = fileName;
    this.writeToFile = writeToFile;
    this.logger = logger;
  }

  public getDeploymentFromFile(): TDeployment {
    if (fs.existsSync(this.fileName)) {
      return JSON.parse(fs.readFileSync(this.fileName, 'utf-8'));
    } else {
      this.logger.log(`${this.deploymentName} deployment file not found, a new one will created`);
    }

    return this.createDefaultDeployment();
  }

  public saveDeploymentFileChanges(deployment: TDeployment) {
    const s = JSON.stringify(deployment, null, 2);
    fs.writeFileSync(this.fileName, s, { encoding: 'utf8' });
  }

  public createDeploymentStore(): DeploymentStore {
    const deployment = this.getDeploymentFromFile();
    return {
      getById: (id: string): DeploymentState | undefined => {
        return deployment[id];
      },
      setById: (id: string, deploymentState: DeploymentState) => {
        deployment[id] = deploymentState;

        if (this.writeToFile) {
          this.saveDeploymentFileChanges(deployment);
        }
      },
      stringify: (): string => {
        return JSON.stringify(deployment, null, 2);
      },
    };
  }
}
