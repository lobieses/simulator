import { Networks } from '../blockchain/constants';

export const BLOCK_CLIENTS = {
    [Networks.FANTOM]: 'https://api.thegraph.com/subgraphs/name/beethovenxfi/fantom-blocks',
    [Networks.MAINNET]: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
    [Networks.BNB]: 'https://api.thegraph.com/subgraphs/name/wombat-exchange/bnb-chain-block',
};
