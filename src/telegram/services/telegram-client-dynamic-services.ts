import { FactoryProvider } from '@nestjs/common';

import { TelegramBot } from './telegram-bot';
import { TelegramStoreService } from './telegram-store.service';

import { TelegramBotOptions, TELEGRAM_MODULE_OPTIONS } from '../telegram.options';

export class TelegramClientDynamicServices {
    constructor(private readonly bots: { [key: string]: TelegramBotOptions }) {}

    public createProviders(): FactoryProvider[] {
        return Object.keys(this.bots).map((key: string) => this.createServiceProviders(key, this.bots[key]));
    }

    private createServiceProviders(key: string, config: TelegramBotOptions): FactoryProvider {
        return {
            provide: key,
            useFactory: (telegramStoreService: TelegramStoreService) => new TelegramBot(config.token, config.redisKey, telegramStoreService, key, config.polling),
            inject: [TelegramStoreService, TELEGRAM_MODULE_OPTIONS],
        };
    }
}
