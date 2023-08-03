import { Networks } from '../blockchain/constants';

const NetworkIds = {
    [Networks.FANTOM]: 'ftm',
    [Networks.MAINNET]: 'eth',
    [Networks.BNB]: 'bsc',
};

export const getUrl = (network: Networks, poolAddress: string, timestamp?: number): string =>
    `https://api.geckoterminal.com/api/v2/networks/${NetworkIds[network]}/pools/${poolAddress}/ohlcv/hour?before_timestamp=${timestamp ?? Math.floor(Date.now() / 1000)}&limit=720`;
