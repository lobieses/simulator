import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RateHelpersService } from './services/rate-helpers.service';
import { RateService } from './services/rate.service';
import { RateController } from './rate.controller';
import { RateHandler } from './rate.handler';
import { GeckoTerminal } from '../../gecko-terminal/gecko-terminal.module';

@Global()
@Module({
    imports: [GeckoTerminal, ScheduleModule.forRoot()],
    providers: [RateHelpersService, RateService, RateHandler],
    controllers: [RateController],
    exports: [RateService],
})
export class RateModule {}
