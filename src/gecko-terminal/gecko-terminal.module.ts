import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GeckoTerminalService } from './gecko-terminal.service';

@Module({
    imports: [HttpModule],
    providers: [GeckoTerminalService],
    exports: [GeckoTerminalService],
})
export class GeckoTerminal {}
