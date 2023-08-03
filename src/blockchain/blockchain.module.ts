import { Global, Module } from '@nestjs/common';
import { EthersModule } from 'nestjs-ethers';

import { ethersModules } from './constants';
import { BlockchainService } from './services/blockchain.service';
import { BlockchainUtilsService } from './services/blockchain-utils.service';

const PROVIDERS = [BlockchainService, BlockchainUtilsService];

@Global()
@Module({
    imports: [...ethersModules.map((config) => EthersModule.forRoot(config))],
    providers: PROVIDERS,
    exports: PROVIDERS,
})
export class BlockchainModule {}
