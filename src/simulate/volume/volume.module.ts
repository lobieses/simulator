import { Module } from '@nestjs/common';
import { VolumeHandler } from './volume.handler';
import { StrategyController } from './volume.controller';
import { GraphModule } from '../../graph/graph.module';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAME } from './constants';
import { VolumeProcessor } from './volume.processor';
import { VolumeHelpers } from './services/volume-helpers.service';
import { VolumeUtils } from './services/volume-utils.service';
import { DockerModule } from '../../docker-operator/docker.module';

@Module({
    imports: [GraphModule, BullModule.registerQueue({ name: QUEUE_NAME }), DockerModule],
    providers: [VolumeHandler, VolumeProcessor, VolumeHelpers, VolumeUtils],
    controllers: [StrategyController],
})
export class VolumeModule {}
