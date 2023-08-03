import { Currency } from '@real-wagmi/sdk';
import { Networks } from '../../../../../blockchain/constants';

// a list of tokens by chain
export type ChainMap<T> = {
    readonly [chainId in Networks]: T;
};

export type ChainCurrencyList = ChainMap<Currency[]>;
