import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';
import { DOCKER_SOCKET_PATH } from '../env';
import { LoggerService } from '../logger/logger.service';
import { anvilContainerConfig } from '../simulate/volume/configs/anvil-container-config';
import { DockerUtilsSvc } from './docker.utils';
import { ANVIL_CONTAINER_NAME } from './constants';

interface IDockerSvc {
    raiseAnvilContainer: (jsonRpcUrl: string) => Promise<string>;
    removeAnvilContainer: () => Promise<void>;
}

@Injectable()
export class DockerSvc implements IDockerSvc {
    private $docker: Docker;

    constructor(private readonly loggerService: LoggerService, private readonly dockerUtils: DockerUtilsSvc) {}

    private async onModuleInit() {
        this.$docker = new Docker({ socketPath: DOCKER_SOCKET_PATH });
        await this.$docker
            .info()
            .then(() => this.loggerService.info('docker controller have successfully connected with your machine'))
            .catch((e) => this.loggerService.info('error on connection with docker socket ====> ' + e));
    }

    public async raiseAnvilContainer(jsonRpcUrl: string) {
        try {
            await this.dockerUtils.removeContainerIfExist(this.$docker, ANVIL_CONTAINER_NAME);

            const container = await this.$docker.createContainer(anvilContainerConfig(jsonRpcUrl, ANVIL_CONTAINER_NAME));

            await this.dockerUtils.startContainer(container);
            const ip = await this.dockerUtils.getContainerIp(container);
            return ip;
        } catch (e) {
            this.loggerService.info('error on raising anvil container ====> ' + e);
        }
    }

    public async removeAnvilContainer() {
        try {
            await this.dockerUtils.removeContainerIfExist(this.$docker, ANVIL_CONTAINER_NAME);
        } catch (e) {
            this.loggerService.info('error on removing anvil container ====> ' + e);
        }
    }
}
