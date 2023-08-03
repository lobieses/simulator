import { Networks } from '../../../../../blockchain/constants';

// Cost for crossing an uninitialized tick.
export const COST_PER_UNINIT_TICK = 0n;

export const BASE_SWAP_COST_V3 = (id: Networks): bigint => {
    switch (id) {
        case Networks.FANTOM:
        case Networks.BNB:
        case Networks.MAINNET:
            return 2000n;
        default:
            return 0n;
    }
};
export const COST_PER_INIT_TICK = (id: Networks): bigint => {
    switch (id) {
        case Networks.FANTOM:
        case Networks.BNB:
        case Networks.MAINNET:
            return 31000n;
        default:
            return 0n;
    }
};

export const COST_PER_HOP_V3 = (id: Networks): bigint => {
    switch (id) {
        case Networks.FANTOM:
        case Networks.BNB:
        case Networks.MAINNET:
            return 80000n;
        default:
            return 0n;
    }
};

export const MSG_SENDER = '0x0000000000000000000000000000000000000001';
export const ADDRESS_THIS = '0x0000000000000000000000000000000000000002';
