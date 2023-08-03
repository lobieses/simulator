import { DynamicModule, Global, Module } from '@nestjs/common';

import { TelegramClientDynamicServices } from './services/telegram-client-dynamic-services';
import { TelegramStoreService } from './services/telegram-store.service';
import { TelegramModuleOptions, TELEGRAM_MODULE_OPTIONS } from './telegram.options';

const PROVIDERS = [TelegramStoreService];

let alreadyImported: string;

@Global()
@Module({
    providers: PROVIDERS,
    exports: PROVIDERS,
})
export class TelegramModule {
    public static forRoot(options: TelegramModuleOptions): DynamicModule {
        if (typeof alreadyImported !== 'undefined') {
            const msg = "Module 'TelegramModule' already imported. Module is 'Global'. 'TelegramModule' must be imported in the main module of the application only.";
            const er = new Error(msg);

            // TODO: use logger

            // eslint-disable-next-line no-console
            console.error(msg);
            // eslint-disable-next-line no-console
            console.error('First import was here:');
            // eslint-disable-next-line no-console
            console.error(alreadyImported);
            // eslint-disable-next-line no-console
            console.error('Second import here:');
            // eslint-disable-next-line no-console
            console.error(er.stack);

            throw er;
        }

        alreadyImported = new Error().stack;

        const telegramServiceProviders = options.bots ? new TelegramClientDynamicServices(options.bots).createProviders() : [];

        const moduleProviders = [
            {
                provide: TELEGRAM_MODULE_OPTIONS,
                useValue: options,
            },
            ...telegramServiceProviders,
        ];

        return {
            module: TelegramModule,
            providers: moduleProviders,
            exports: moduleProviders,
        };
    }
}
