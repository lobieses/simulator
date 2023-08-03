import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SimulateRateDto } from './dto/simulate-rate.dto';
import { RateHandler } from './rate.handler';

@ApiTags('Simulate Volume')
@Controller('simulate/rate')
export class RateController {
    constructor(private readonly rateHandler: RateHandler) {}

    @Post()
    public simulateRate(@Body() body: SimulateRateDto) {
        return this.rateHandler.simulateRate(body);
    }
}
