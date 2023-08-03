import { Injectable } from '@nestjs/common';
import { utils } from '@thanpolas/univ3prices';
import { BigNumber } from 'ethers';

@Injectable()
export class BlockchainUtilsService {
    public getSqrtPrice(reserve0: BigNumber, reserve1: BigNumber): string {
        return utils.encodeSqrtRatioX96(reserve1, reserve0);
    }
}
