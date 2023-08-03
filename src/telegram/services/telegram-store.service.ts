import { Injectable } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';

@Injectable()
export class TelegramStoreService {
    constructor(private readonly redisService: RedisService) {}

    public async get(key: string): Promise<number[]> {
        const store = await this.redisService.getClient().get(key);
        return store ? JSON.parse(store) : [];
    }

    public async set(id: number, key: string) {
        const exist = await this.get(key);

        if (!exist.includes(id)) {
            exist.push(id);
            await this.redisService.getClient().set(key, JSON.stringify(exist));
        }
    }
}
