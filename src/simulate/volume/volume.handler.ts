import { Inject, Injectable } from '@nestjs/common';
import { SimulateVolumeV2Dto } from './dto/simulate-volume-v2.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAME, PROCESS_NAME } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { TelegramBot } from '../../telegram/services/telegram-bot';

@Injectable()
export class VolumeHandler {
    constructor(
        @InjectQueue(QUEUE_NAME)
        private readonly volumeSimulatorQueue: Queue,
        @Inject('wagmi_volume_simulator_bot')
        private readonly wagmiVolumeSimulatorBot: TelegramBot,
    ) {}

    public async simulateVolume(dto: SimulateVolumeV2Dto) {
        const simulateId = uuidv4();
        await this.volumeSimulatorQueue.add(PROCESS_NAME, { ...dto, id: simulateId });
        await this.wagmiVolumeSimulatorBot.sendToChats(`Added new volume simulation: ${simulateId}.`);
        return { simulateId };
    }
}
