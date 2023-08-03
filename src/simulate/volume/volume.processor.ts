import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PROCESS_NAME, QUEUE_NAME } from './constants';
import { LoggerService } from '../../logger/logger.service';
import { Inject } from '@nestjs/common';
import { TelegramBot } from '../../telegram/services/telegram-bot';
import { IVolumeSimulatorJob } from './type';
import { GraphService } from '../../graph/services/graph.service';
import getZeroDayTimestamp from '../../utils/get-zero-day-timestamp';
import { firstValueFrom } from 'rxjs';
import { VolumeHelpers } from './services/volume-helpers.service';
import { BlockchainService } from '../../blockchain/services/blockchain.service';
import { ethersModules, Protocol } from '../../blockchain/constants';
import { BlockchainUtilsService } from '../../blockchain/services/blockchain-utils.service';
import { RateService } from '../rate/services/rate.service';
import { Address } from 'viem';
import { VolumeUtils } from './services/volume-utils.service';
import { CurrencyAmount } from '@real-wagmi/sdk';
import { SIMULATION_PATH } from '../../env';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { TEST_ACCOUNT } from './constants';
import { DockerSvc } from '../../docker-operator/docker.service';

@Processor(QUEUE_NAME)
export class VolumeProcessor {
    constructor(
        private readonly loggerService: LoggerService,
        @Inject('wagmi_volume_simulator_bot')
        private readonly wagmiVolumeSimulatorBot: TelegramBot,
        private readonly graphService: GraphService,
        private readonly blockchainService: BlockchainService,
        private readonly blockchainUtilsService: BlockchainUtilsService,
        private readonly rateService: RateService,
        private readonly volumeHelpers: VolumeHelpers,
        private readonly volumeUtils: VolumeUtils,
        private readonly dockerSvc: DockerSvc,
    ) {}

    @Process(PROCESS_NAME)
    async handleSimulate(job: Job<IVolumeSimulatorJob>) {
        try {
            const jsonRpcUrl = ethersModules.find((module) => module.network === job.data.network).custom as string;

            if (!existsSync(SIMULATION_PATH)) {
                mkdirSync(SIMULATION_PATH);
            }
            if (!existsSync(`${SIMULATION_PATH}/${job.data.network}`)) {
                mkdirSync(`${SIMULATION_PATH}/${job.data.network}`);
            }
            if (!existsSync(`${SIMULATION_PATH}/${job.data.network}/${job.data.poolAddress}`)) {
                mkdirSync(`${SIMULATION_PATH}/${job.data.network}/${job.data.poolAddress}`);
            }
            if (!existsSync(`${SIMULATION_PATH}/${job.data.network}/${job.data.poolAddress}/${job.data.fromTimestamp}-${job.data.toTimestamp}`)) {
                mkdirSync(`${SIMULATION_PATH}/${job.data.network}/${job.data.poolAddress}/${job.data.fromTimestamp}-${job.data.toTimestamp}`);
            }
            this.loggerService.info('Start volume simulation job', { extra: { ...job.data } });

            const toTimestamp = getZeroDayTimestamp(job.data.toTimestamp);
            const fromTimestamp = getZeroDayTimestamp(job.data.fromTimestamp);

            const fromBlock = await firstValueFrom(this.graphService.getBlockNumberByTimestamp(job.data.network, fromTimestamp));
            const toBlock = await firstValueFrom(this.graphService.getBlockNumberByTimestamp(job.data.network, toTimestamp));

            let token0Address: string;
            let token1Address: string;

            if (job.data.protocol === Protocol.V2) {
                const pool = this.blockchainService.getUniswapV2Pool(job.data.network, job.data.poolAddress);
                token0Address = await pool.token0();
                token1Address = await pool.token1();
            } else {
                const pool = this.blockchainService.getUniswapV3Pool(job.data.network, job.data.poolAddress);
                token0Address = await pool.token0();
                token1Address = await pool.token1();
            }
            this.loggerService.info('tokens address find');
            const logs = await this.blockchainService.getSwapLogs(job.data.network, job.data.protocol, job.data.poolAddress, fromBlock, toBlock);
            this.loggerService.info('Logs was downloaded');
            let sqrtPrice: string;
            if (job.data.protocol === Protocol.V2) {
                const [reserve0, reserve1] = await this.blockchainService.getUniswapV2Reserves(job.data.network, job.data.poolAddress, logs[0]?.blockNumber);
                sqrtPrice = this.blockchainUtilsService.getSqrtPrice(reserve0, reserve1);
            } else {
                const pool = this.blockchainService.getUniswapV3Pool(job.data.network, job.data.poolAddress);
                const slot0 = await pool.slot0({ blockTag: logs[0]?.blockNumber });
                sqrtPrice = slot0.sqrtPriceX96.toString();
            }
            this.loggerService.info('sqrtPrice was calculated');
            const { change } = await firstValueFrom(this.rateService.getRate(job.data.network, job.data.poolAddress, toTimestamp));
            this.loggerService.info('price change was calculated');

            for (const percents of job.data.initialPercentage) {
                const anvilIp = await this.dockerSvc.raiseAnvilContainer(jsonRpcUrl);

                const { testClient, onChainClient, chain } = await this.volumeHelpers.createConnect(job.data.network, anvilIp);
                this.loggerService.info('create connect');
                const token0 = await this.volumeUtils.getToken(testClient, onChainClient, job.data.token0Wallet as Address, token0Address as Address);
                this.loggerService.info('token0 create');
                const balance0 = await this.volumeUtils.balanceOf(onChainClient, token0.address, TEST_ACCOUNT.address as Address);
                this.loggerService.info(`token0 balance: ${balance0.toString()}`);
                const token1 = await this.volumeUtils.getToken(testClient, onChainClient, job.data.token1Wallet as Address, token1Address as Address);
                this.loggerService.info('token1 create');
                const balance1 = await this.volumeUtils.balanceOf(onChainClient, token1.address, TEST_ACCOUNT.address as Address);
                this.loggerService.info(`token1 balance: ${balance1.toString()}`);
                const startText = `
                  Start new volume simulate ${job.data.id}
                  network: ${job.data.network}
                  pair: ${token0.symbol}/${token1.symbol}
                  sqrtPrice: ${sqrtPrice}
                  price change: ${change}
                  initial percentages: ${percents.toString()}
                `;
                await this.wagmiVolumeSimulatorBot.sendToChats(startText);
                const { initial, collect, end, convertT0, convertT1, parsed } = await this.volumeHelpers.simulate(
                    testClient,
                    onChainClient,
                    chain,
                    job.data.poolAddress as Address,
                    token0,
                    token1,
                    logs,
                    BigInt(sqrtPrice),
                    change,
                    job.data.protocol,
                    percents,
                    job.data.token0Liquidity,
                    job.data.token1Liquidity,
                );

                const total = CurrencyAmount.fromRawAmount(token1, convertT1.start);
                const low = CurrencyAmount.fromRawAmount(token1, initial.low.convertad);
                const medium = CurrencyAmount.fromRawAmount(token1, initial.medium.convertad);
                const lower = CurrencyAmount.fromRawAmount(token1, initial.lower.convertad);
                const upper = CurrencyAmount.fromRawAmount(token1, initial.upper.convertad);

                const lowPercent = ((+low.toExact() * 100) / +total.toExact()).toFixed(2);
                const mediumPercent = ((+medium.toExact() * 100) / +total.toExact()).toFixed(2);
                const lowerPercent = ((+lower.toExact() * 100) / +total.toExact()).toFixed(2);
                const upperPercent = ((+upper.toExact() * 100) / +total.toExact()).toFixed(2);

                const endText = `
              Simulation ${job.data.id} was done
              time: ${job.data.fromTimestamp}-${job.data.toTimestamp}
              blocks: ${fromBlock}-${toBlock}
              pair: ${token0.symbol}/${token1.symbol}
              pool address: ${job.data.poolAddress}
              sqrtPrice: ${sqrtPrice}
              initial percentages: ${percents.toString()}
              price change: ${change}
              initial deposit:
                total:
                  token0: ${CurrencyAmount.fromRawAmount(token0, initial.total.token0).toExact()}
                  token1: ${CurrencyAmount.fromRawAmount(token1, initial.total.token1).toExact()}
                0.05%:
                  token0: ${CurrencyAmount.fromRawAmount(token0, initial.low.token0).toExact()}
                  token1: ${CurrencyAmount.fromRawAmount(token1, initial.low.token1).toExact()}
                  tickLower: ${initial.low.tickLower.toString()}
                  tickUpper: ${initial.low.tickUpper.toString()}
                  percent: ${lowPercent}%
                0.3%:
                  token0: ${CurrencyAmount.fromRawAmount(token0, initial.medium.token0).toExact()}
                  token1: ${CurrencyAmount.fromRawAmount(token1, initial.medium.token1).toExact()}
                  tickLower: ${initial.medium.tickLower.toString()}
                  tickUpper: ${initial.medium.tickUpper.toString()}
                  percent: ${mediumPercent}%
                1%:
                  lower:
                    token0: ${CurrencyAmount.fromRawAmount(token0, initial.lower.token0).toExact()}
                    token1: ${CurrencyAmount.fromRawAmount(token1, initial.lower.token1).toExact()}
                    tickLower: ${initial.lower.tickLower.toString()}
                    tickUpper: ${initial.lower.tickUpper.toString()}
                    percent: ${lowerPercent}%
                  upper:
                    token0: ${CurrencyAmount.fromRawAmount(token0, initial.upper.token0).toExact()}
                    token1: ${CurrencyAmount.fromRawAmount(token1, initial.upper.token1).toExact()}
                    tickLower: ${initial.upper.tickLower.toString()}
                    tickUpper: ${initial.upper.tickUpper.toString()}
                    percent: ${upperPercent}%
              was collect:
                token0: ${CurrencyAmount.fromRawAmount(token0, collect.token0).toExact()}
                token1: ${CurrencyAmount.fromRawAmount(token1, collect.token1).toExact()}
              end deposit:
                token0: ${CurrencyAmount.fromRawAmount(token0, end.token0).toExact()}
                token1: ${CurrencyAmount.fromRawAmount(token1, end.token1).toExact()}
              convert to token1
                start: ${CurrencyAmount.fromRawAmount(token1, convertT1.start).toExact()}
                end: ${CurrencyAmount.fromRawAmount(token1, convertT1.end).toExact()}
              convert to token0
                start: ${CurrencyAmount.fromRawAmount(token0, convertT0.start).toExact()}
                end: ${CurrencyAmount.fromRawAmount(token0, convertT0.end).toExact()}
              logs:
                total: ${parsed.total}
                simulated: ${parsed.current}
                failted: ${parsed.failted}
            `;
                writeFileSync(
                    `${SIMULATION_PATH}/${job.data.network}/${job.data.poolAddress}/${job.data.fromTimestamp}-${job.data.toTimestamp}/${percents.join('-')}.text`,
                    endText,
                );

                await this.dockerSvc.removeAnvilContainer();
                await this.wagmiVolumeSimulatorBot.sendToChats(endText);
            }
        } catch (error) {
            console.log(error);
            const errorText = `
              Simulation ${job.data.id} was failed
              error: ${error}
            `;
            this.loggerService.error('Volume simulation job faild', { extra: { ...job.data }, error });
            await this.wagmiVolumeSimulatorBot.sendToChats(errorText);
            await this.dockerSvc.removeAnvilContainer();
        }
    }
}
