import { OnChainProvider, PoolProvider, SubgraphProvider } from '../../types';
import { createPoolProviderWithCache } from './pool-provider-with-cache';
import { getCandidatePools } from './get-candidate-pools';

interface HybridProviderConfig {
    onChainProvider?: OnChainProvider;
    v3SubgraphProvider?: SubgraphProvider;
}

export function createHybridPoolProvider({ onChainProvider, v3SubgraphProvider }: HybridProviderConfig): PoolProvider {
    const hybridPoolProvider: PoolProvider = {
        getCandidatePools: async (params) => {
            return getCandidatePools({ ...params, onChainProvider, v3SubgraphProvider });
        },
    };

    return createPoolProviderWithCache(hybridPoolProvider);
}
