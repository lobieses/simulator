import { Injectable } from '@nestjs/common';
import { BLOCK_CLIENTS } from '../constants';
import { Networks } from '../../blockchain/constants';
import { InvalidArgumentException } from 'src/exceptions/exceptions';

@Injectable()
export class GraphHelpersService {
    public getBlockUrl(network: Networks): string {
        switch (network) {
            default: {
                throw new InvalidArgumentException();
            }

            case Networks.FANTOM: {
                return BLOCK_CLIENTS[Networks.FANTOM];
            }

            case Networks.MAINNET: {
                return BLOCK_CLIENTS[Networks.MAINNET];
            }

            case Networks.BNB: {
                return BLOCK_CLIENTS[Networks.BNB];
            }
        }
    }
}
