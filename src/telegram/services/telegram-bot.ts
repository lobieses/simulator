import { Logger } from '@nestjs/common';
import * as TBot from 'node-telegram-bot-api';

import { TelegramStoreService } from './telegram-store.service';

export class TelegramBot {
    private token: string;

    private redisKey: string;

    private telegramStoreService: TelegramStoreService;

    private bot: TBot;

    private logger: Logger;

    constructor(token: string, redisKey: string, telegramStoreService: TelegramStoreService, name: string, polling: boolean) {
        this.token = token;
        this.redisKey = redisKey;
        this.telegramStoreService = telegramStoreService;
        this.logger = new Logger(`Telegram bot ${name}`);

        this.initBot(polling);
    }

    private initBot(polling: boolean) {
        this.bot = new TBot(this.token, { polling });
        this.logger.log('bot start');

        this.bot.onText(/\/start/, (ctx) => {
            const { first_name, last_name } = ctx.from;
            const { id } = ctx.chat;
            this.bot.sendMessage(id, `Welcome ${first_name} ${last_name}. Let's start 🔥🔥🔥`);
            this.logger.log(`new chat: ${id}`);
            this.telegramStoreService.set(id, this.redisKey);
        });
    }

    public async sendToChats(text: string) {
        const chats = await this.telegramStoreService.get(this.redisKey);

        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];

            try {
                await this.bot.sendMessage(chat, text);
            } catch (err) {}
        }
    }
}
