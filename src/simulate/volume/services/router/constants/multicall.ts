import { Networks } from '../../../../../blockchain/constants';

import { ChainMap, BatchMulticallConfigs } from '../types';

export const BATCH_MULTICALL_CONFIGS: ChainMap<BatchMulticallConfigs> = {
    [Networks.BNB]: {
        defaultConfig: {
            multicallChunk: 50,
            gasLimitOverride: 1_000_000,
        },
        gasErrorFailureOverride: {
            gasLimitOverride: 1_000_000,
            multicallChunk: 40,
        },
        successRateFailureOverrides: {
            gasLimitOverride: 1_000_000,
            multicallChunk: 45,
        },
    },
    [Networks.FANTOM]: {
        defaultConfig: {
            multicallChunk: 150,
            gasLimitOverride: 1_000_000,
        },
        gasErrorFailureOverride: {
            gasLimitOverride: 1_000_000,
            multicallChunk: 30,
        },
        successRateFailureOverrides: {
            gasLimitOverride: 1_000_000,
            multicallChunk: 40,
        },
    },
    [Networks.MAINNET]: {
        defaultConfig: {
            multicallChunk: 50,
            gasLimitOverride: 1_000_000,
        },
        gasErrorFailureOverride: {
            gasLimitOverride: 1_000_000,
            multicallChunk: 40,
        },
        successRateFailureOverrides: {
            gasLimitOverride: 1_000_000,
            multicallChunk: 45,
        },
    },
};
