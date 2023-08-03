import { Module } from '@nestjs/common';
import { DockerSvc } from './docker.service';
import { DockerUtilsSvc } from './docker.utils';

@Module({
    providers: [DockerSvc, DockerUtilsSvc],
    exports: [DockerSvc],
})
export class DockerModule {}
