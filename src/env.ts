import { join } from 'path';
import { TelegramModuleOptions } from './telegram/telegram.options';
import { RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { BullRootModuleOptions } from '@nestjs/bull';

const { env } = process;

// App
export const APP_PORT = parseInt(env.APP_PORT);
export const APP_VERSION = env.npm_package_version;

export const FILE_FOLDER_PATH = join(process.cwd(), '/uploads');

// Logger
export const LOG_FOLDER_PATH = join(process.cwd(), '/logs');

const SIMULATION_DIRECTORY = 'simulation';

export const SIMULATION_PATH = join(process.cwd(), `/${SIMULATION_DIRECTORY}`);

export const LOCAL_SIMULATION_PATH = SIMULATION_DIRECTORY;

//Anvil
export const ANVIL_IMAGE_NAME = env.ANVIL_IMAGE_NAME;

//Docker
export const DOCKER_SOCKET_PATH = env.DOCKER_SOCKET_PATH;

// Blockchain
export const { FTM_RPC, BNB_RPC, ETH_RPC } = env;

const TELEGRAM_POLLING = env.TELEGRAM_POLLING === 'true' ? true : false;

// Telegram
export const telegramMoluleOptions: TelegramModuleOptions = {
    bots: {
        wagmi_volume_simulator_bot: {
            token: '6092378794:AAHGzWCYKnlJWwjKRtzCOFjKVhhnPzPSkKo',
            redisKey: 'users-ff0952db279f408673906c9d5b8929c272d1233d91116',
            polling: TELEGRAM_POLLING,
        },
    },
};

// Redis
export const redisOptions: RedisModuleOptions = {
    config: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        db: parseInt(process.env.REDIS_DB),
        password: process.env.REDIS_PASSWORD,
    },
};

// Bull
export const bullConfig: BullRootModuleOptions = {
    redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        db: parseInt(process.env.REDIS_DB),
        password: process.env.REDIS_PASSWORD,
    },
};
