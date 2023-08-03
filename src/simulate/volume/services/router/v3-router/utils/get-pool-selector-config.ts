import { Currency } from '@real-wagmi/sdk';

import { DEFAULT_POOL_SELECTOR_CONFIG, V3_DEFAULT_POOL_SELECTOR_CONFIG, V3_TOKEN_POOL_SELECTOR_CONFIG } from '../constants';
import { PoolSelectorConfig, PoolSelectorConfigChainMap, TokenPoolSelectorConfigChainMap } from '../types';
import { mergePoolSelectorConfig } from './merge-pool-selector-config';

function poolSelectorConfigFactory(poolSelecorConfigMap: PoolSelectorConfigChainMap, tokenPoolSelectorConfigMap: TokenPoolSelectorConfigChainMap) {
    return function getPoolSelectorConfig(currencyA?: Currency, currencyB?: Currency): PoolSelectorConfig {
        const chainId = currencyA?.chainId;
        if (!chainId || !poolSelecorConfigMap[chainId]) {
            return DEFAULT_POOL_SELECTOR_CONFIG;
        }

        const additionalConfigA = tokenPoolSelectorConfigMap[chainId]?.[currencyA?.wrapped?.address || '0x'];
        const additionalConfigB = tokenPoolSelectorConfigMap[chainId]?.[currencyB?.wrapped?.address || '0x'];
        return mergePoolSelectorConfig(mergePoolSelectorConfig(poolSelecorConfigMap[chainId], additionalConfigA), additionalConfigB);
    };
}

export const getV3PoolSelectorConfig = poolSelectorConfigFactory(V3_DEFAULT_POOL_SELECTOR_CONFIG, V3_TOKEN_POOL_SELECTOR_CONFIG);
