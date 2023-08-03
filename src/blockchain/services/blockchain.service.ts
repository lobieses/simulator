import { Injectable } from '@nestjs/common';
import { InjectEthersProvider } from 'nestjs-ethers';
import { BaseProvider } from '@ethersproject/providers';
import { Log } from '@ethersproject/abstract-provider';

import { ERC20, ERC20__factory, UniswapV3Pool, UniswapV3Pool__factory, UniswapV2Pool, UniswapV2Pool__factory } from '../../typechain';
import { Protocol } from '../constants';

import { Networks, LOG_STEP, SWAP_TOPICS } from '../constants';
import { LoggerService } from 'src/logger/logger.service';
import { BigNumber } from 'ethers';

@Injectable()
export class BlockchainService {
    constructor(
        @InjectEthersProvider('ftm')
        private readonly ftmProvider: BaseProvider,
        @InjectEthersProvider('bnb')
        private readonly bscProvider: BaseProvider,
        @InjectEthersProvider('eth')
        private readonly ethProvider: BaseProvider,
        private readonly loggerService: LoggerService,
    ) {}

    public getProvider(network: Networks): BaseProvider {
        if (network === Networks.FANTOM) return this.ftmProvider;
        if (network === Networks.BNB) return this.bscProvider;
        if (network === Networks.MAINNET) return this.ethProvider;

        throw new Error(`${network} provider not implemented`);
    }

    public async getTimestamp(network: Networks, blockNumber: number): Promise<number> {
        const provider = this.getProvider(network);
        const block = await provider.getBlock(blockNumber);
        return block.timestamp;
    }

    public getTransaction(network: Networks, hash: string) {
        const provider = this.getProvider(network);
        return provider.getTransaction(hash);
    }

    public getToken(network: Networks, address: string): ERC20 {
        const provider = this.getProvider(network);
        return ERC20__factory.connect(address, provider);
    }

    public getUniswapV3Pool(network: Networks, address: string): UniswapV3Pool {
        const provider = this.getProvider(network);
        return UniswapV3Pool__factory.connect(address, provider);
    }

    public getUniswapV2Pool(network: Networks, address: string): UniswapV2Pool {
        const provider = this.getProvider(network);
        return UniswapV2Pool__factory.connect(address, provider);
    }

    public async getSwapLogs(network: Networks, protocol: Protocol, address: string, from: number, to: number): Promise<Log[]> {
        const swapTopic = SWAP_TOPICS[protocol];
        const provider = this.getProvider(network);
        const allLogs = [];
        const steps = Math.floor((to - from) / LOG_STEP);
        for (let i = 0; i < steps + 1; i++) {
            const fromBlock = from + i * LOG_STEP;
            let toBlock = fromBlock + LOG_STEP;
            toBlock = toBlock > to ? to : toBlock;
            this.loggerService.info(`${address} | ${network} | from: ${fromBlock}, to: ${toBlock} | ${i}-${steps + 1}`);

            const logs = await provider.getLogs({ fromBlock, toBlock, address, topics: [swapTopic] });
            allLogs.push(...logs);
        }
        return allLogs;
    }

    public async getUniswapV2Reserves(network: Networks, address: string, blockTag?: string | number): Promise<BigNumber[]> {
        const pool = this.getUniswapV2Pool(network, address);
        const [reserve0, reserve1] = await pool.getReserves({ blockTag });
        return [reserve0, reserve1];
    }
}
