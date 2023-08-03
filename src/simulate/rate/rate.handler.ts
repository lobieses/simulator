import { Injectable } from '@nestjs/common';
import { RateService } from './services/rate.service';
import { SimulateRateDto } from './dto/simulate-rate.dto';

@Injectable()
export class RateHandler {
    constructor(private readonly rateService: RateService) {}

    public simulateRate({ network, poolAddress, timestamp }: SimulateRateDto) {
        return this.rateService.getRate(network, poolAddress, timestamp);
    }
}
