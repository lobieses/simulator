import { Injectable } from '@nestjs/common';
import { LOCAL_SIMULATION_PATH } from '../../env';
import { LoggerService } from '../../logger/logger.service';
import { ArchiverUtilsSvc } from './archiver.utils';

interface IArchiverSvc {
    getZippedSimulation: (output: any) => void;
}

@Injectable()
export class ArchiverSvc implements IArchiverSvc {
    constructor(private readonly loggerService: LoggerService, private readonly archiverUtils: ArchiverUtilsSvc) {}

    public getZippedSimulation(output) {
        this.archiverUtils.getZippedDir(LOCAL_SIMULATION_PATH, output);
    }
}
