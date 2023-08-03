import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { MulterModule } from '@nestjs/platform-express';
import { FILE_FOLDER_PATH } from '../env';
import { ArchiverSvc } from './archiver/archiver.service';
import { ArchiverUtilsSvc } from './archiver/archiver.utils';

@Module({
    imports: [MulterModule.register({ dest: FILE_FOLDER_PATH, limits: { fileSize: 104857600, fields: 1 } })],
    controllers: [StorageController],
    providers: [ArchiverSvc, ArchiverUtilsSvc],
})
export class StorageModule {}
