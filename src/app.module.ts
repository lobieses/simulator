import { Module } from '@nestjs/common';
import { BlockchainModule } from './blockchain/blockchain.module';
import { ExceptionsModule } from './exceptions/exceptions.module';
import { LoggerModule } from './logger/logger.module';
import { StorageModule } from './storage/storage.module';
import { SimulateModule } from './simulate/simulate.module';
import { GraphModule } from './graph/graph.module';
import { TelegramModule } from './telegram/telegram.module';
import { redisOptions, telegramMoluleOptions, bullConfig } from './env';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { BullModule } from '@nestjs/bull';
import { DockerModule } from './docker-operator/docker.module';

@Module({
    imports: [
        BlockchainModule,
        ExceptionsModule,
        LoggerModule,
        StorageModule,
        SimulateModule,
        GraphModule,
        SimulateModule,
        TelegramModule.forRoot(telegramMoluleOptions),
        RedisModule.forRoot(redisOptions, true),
        BullModule.forRoot(bullConfig),
        DockerModule,
    ],
})
export class AppModule {}
