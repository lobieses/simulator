import { BatchMulticallConfigs, ChainMap } from '../../types';
import { QuoteProvider, OnChainProvider, RouteWithoutQuote, RouteWithQuote, RouteType, QuoterOptions } from '../types';
import { isV3Pool } from '../utils';
import { createOffChainQuoteProvider } from './off-chain-quote-provider';
import { createV3OnChainQuoteProvider } from './on-chain-quote-provider';

interface Config {
    onChainProvider: OnChainProvider;
    multicallConfigs?: ChainMap<BatchMulticallConfigs>;
}

// For evm
export function createQuoteProvider({ onChainProvider, multicallConfigs }: Config): QuoteProvider {
    const offChainQuoteProvider = createOffChainQuoteProvider();
    const v3OnChainQuoteProvider = createV3OnChainQuoteProvider({ onChainProvider, multicallConfigs });

    const createGetRouteWithQuotes = (isExactIn = true) => {
        const getOffChainQuotes = isExactIn ? offChainQuoteProvider.getRouteWithQuotesExactIn : offChainQuoteProvider.getRouteWithQuotesExactOut;
        const getV3Quotes = isExactIn ? v3OnChainQuoteProvider.getRouteWithQuotesExactIn : v3OnChainQuoteProvider.getRouteWithQuotesExactOut;

        return async function getRoutesWithQuotes(routes: RouteWithoutQuote[], { blockNumber, gasModel }: QuoterOptions): Promise<RouteWithQuote[]> {
            const v3Routes: RouteWithoutQuote[] = [];
            const mixedRoutesHaveV3Pool: RouteWithoutQuote[] = [];
            const routesCanQuoteOffChain: RouteWithoutQuote[] = [];
            for (const route of routes) {
                if (route.type === RouteType.V3) {
                    v3Routes.push(route);
                    continue;
                }
                const { pools } = route;
                if (pools.some((pool) => isV3Pool(pool))) {
                    mixedRoutesHaveV3Pool.push(route);
                    continue;
                }
                routesCanQuoteOffChain.push(route);
            }

            const [offChainQuotes, v3Quotes] = await Promise.all([
                getOffChainQuotes(routesCanQuoteOffChain, { blockNumber, gasModel }),
                getV3Quotes(v3Routes, { blockNumber, gasModel }),
            ]);
            return [...offChainQuotes, ...v3Quotes];
        };
    };

    return {
        getRouteWithQuotesExactIn: createGetRouteWithQuotes(true),
        getRouteWithQuotesExactOut: createGetRouteWithQuotes(false),
    };
}
