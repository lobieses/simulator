import { Token, WETH9, fantomTokens, nativeOnChain, zkSyncTokens } from '@real-wagmi/sdk';

import { ChainCurrencyList } from '../types';
import { USDC_BNB_TOKEN, USDC_FANTOM_TOKEN, USDC_MAINNET_TOKEN } from '../../../constants';
import { Networks } from '../../../../../blockchain/constants';

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST: ChainCurrencyList = {
    [Networks.FANTOM]: [USDC_FANTOM_TOKEN],
    [Networks.BNB]: [USDC_BNB_TOKEN],
    [Networks.MAINNET]: [USDC_MAINNET_TOKEN],
};

/**
 * Additional bases for specific tokens
 * @example { [WBTC.address]: [renBTC], [renBTC.address]: [WBTC] }
 */
export const ADDITIONAL_BASES: {
    [chainId in Networks]?: { [tokenAddress: string]: Token[] };
} = {};

/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 * @example [AMPL.address]: [DAI, WNATIVE[ChainId.BSC]]
 */
export const CUSTOM_BASES: {
    [chainId in Networks]?: { [tokenAddress: string]: Token[] };
} = {};
