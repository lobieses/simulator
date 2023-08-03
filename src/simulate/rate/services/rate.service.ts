import { Injectable } from '@nestjs/common';
import { Networks } from '../../../blockchain/constants';
import { RateHelpersService } from './rate-helpers.service';
import { map } from 'rxjs';
import { GeckoTerminalService } from '../../../gecko-terminal/gecko-terminal.service';

@Injectable()
export class RateService {
    constructor(private readonly rateHelpersService: RateHelpersService, private readonly geckoTerminalService: GeckoTerminalService) {}

    public getRate(network: Networks, address: string, timestamp?: number) {
        return this.geckoTerminalService.getPoolOhlcvs(network, address, timestamp).pipe(map((data) => this.rateHelpersService.calculateRange(data)));
    }
}
