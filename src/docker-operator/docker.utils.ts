import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { Container, Docker } from 'dockerode';

interface IDockerUtilsSvc {
    startContainer: (container: Container) => Promise<void>;
    getContainerIp: (container: Container) => Promise<string>;
    removeContainerIfExist: (docker: Docker, name: string) => Promise<void>;
}

@Injectable()
export class DockerUtilsSvc implements IDockerUtilsSvc {
    constructor(private readonly loggerService: LoggerService) {}

    public async startContainer(container: Container) {
        await container.start().catch((e) => this.loggerService.error('error while starting container ====>' + e));
    }

    public async getContainerIp(container: Container) {
        const info = await container.inspect();
        const ip = info['NetworkSettings']['IPAddress'] as string;
        return ip;
    }

    public async removeContainerIfExist(docker: Docker, name: string) {
        const containers = await docker.listContainers({ all: true });
        const foundContainerData = containers.find((container) => container['Names'].some((dockerName) => dockerName === `/${name}`));
        if (foundContainerData) {
            const foundContainer = docker.getContainer(foundContainerData['Id']);
            await foundContainer.remove({ force: true });
        }
    }
}
