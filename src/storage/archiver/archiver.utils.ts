import { Injectable } from '@nestjs/common';
import * as archiver from 'archiver';
import { LoggerService } from '../../logger/logger.service';

interface IArchiverUtilsSvc {
    getZippedDir: (dirPath: string, output: any) => void;
}

@Injectable()
export class ArchiverUtilsSvc implements IArchiverUtilsSvc {
    private readonly archiver: any;

    constructor(private readonly loggerService: LoggerService) {
        this.archiver = archiver('zip');

        this.archiver.on('error', function (err) {
            throw err;
        });
    }

    public getZippedDir(localDirPath: string, output) {
        const archive = archiver('zip');

        output.on('close', () => {
            this.loggerService.info(archive.pointer() + ' total bytes');
        });

        archive.pipe(output);

        archive.directory(`${localDirPath}/`);

        archive.finalize();
    }
}
