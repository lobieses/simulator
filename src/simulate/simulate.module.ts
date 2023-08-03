import { Module } from '@nestjs/common';

import { RateModule } from './rate/rate.module';
import { VolumeModule } from './volume/volume.module';

@Module({
    imports: [RateModule, VolumeModule],
})
export class SimulateModule {}
