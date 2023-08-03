export interface TelegramBotOptions {
    token: string;
    redisKey: string;
    polling: boolean;
}

export interface TelegramModuleOptions {
    bots: {
        [key: string]: TelegramBotOptions;
    };
}

export const TELEGRAM_MODULE_OPTIONS = 'TELEGRAM_MODULE_OPTIONS';
