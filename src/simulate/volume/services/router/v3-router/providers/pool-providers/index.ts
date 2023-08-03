import { OnChainProvider, PoolProvider, SubgraphProvider } from '../../types';
import { createHybridPoolProvider } from './hybrid-pool-provider';

interface Config {
    onChainProvider: OnChainProvider;
    subgraphProvider?: SubgraphProvider;
}

export function createPoolProvider(config: Config): PoolProvider {
    const hybridPoolProvider = createHybridPoolProvider(config);
    return hybridPoolProvider;
}

export * from './on-chain-pool-providers';
export * from './subgraph-pool-providers';
export * from './pool-tvl-selectors';
export * from './hybrid-pool-provider';
export * from './get-v3-candidate-pools';
export * from './get-candidate-pools';
export * from './static-pool-provider';
