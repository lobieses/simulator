import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VolumeHandler } from './volume.handler';
import { SimulateVolumeV2Dto } from './dto/simulate-volume-v2.dto';

@ApiTags('Simulate Volume')
@Controller('simulate/volume')
export class StrategyController {
    constructor(private readonly volumeHandler: VolumeHandler) {}

    @Post()
    public simulateVolume(@Body() body: SimulateVolumeV2Dto) {
        return this.volumeHandler.simulateVolume(body);
    }
}
