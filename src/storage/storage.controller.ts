import { Controller, Post, UseInterceptors, UploadedFile, Get, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoggerService } from 'src/logger/logger.service';
import { ArchiverSvc } from './archiver/archiver.service';

@Controller('/storage')
export class StorageController {
    constructor(private readonly loggerService: LoggerService, private readonly archiver: ArchiverSvc) {}

    @Post('/save')
    @UseInterceptors(FileInterceptor('file'))
    saveFile(@UploadedFile() file: Express.Multer.File) {
        this.loggerService.info('File upload', { extra: { ...file } });
    }

    @Get('/get-simulation')
    getSimulation(@Res() res) {
        res.writeHead(200, {
            ['Content-Type']: 'application/zip',
            ['Content-disposition']: 'attachment; filename=simulation.zip',
        });
        this.archiver.getZippedSimulation(res);
    }
}
