import { BigintIsh, Currency, CurrencyAmount, TradeType } from '@real-wagmi/sdk';
import { PoolProvider, QuoteProvider, PoolType, SmartRouterTrade, BestRoutes } from './types';
import { computeAllRoutes } from './functions';
import { createGasModel } from './gas-model';
import { getRoutesWithValidQuote } from './get-routes-with-valid-quote';
import { getBestRouteCombinationByQuotes } from './functions/get-best-route-combination-by-quotes';

interface TradeConfig {
    gasPriceWei: BigintIsh | (() => Promise<BigintIsh>);
    blockNumber?: number | (() => Promise<number>);
    poolProvider: PoolProvider;
    quoteProvider: QuoteProvider;
    maxHops?: number;
    maxSplits?: number;
    distributionPercent?: number;
    allowedPoolTypes?: PoolType[];
    quoterOptimization?: boolean;
}

export async function getBestTrade(amount: CurrencyAmount<Currency>, currency: Currency, tradeType: TradeType, config: TradeConfig): Promise<SmartRouterTrade<TradeType> | null> {
    const { blockNumber: blockNumberFromConfig } = config;
    const blockNumber: BigintIsh | undefined = typeof blockNumberFromConfig === 'function' ? await blockNumberFromConfig() : blockNumberFromConfig;
    const bestRoutes = await getBestRoutes(amount, currency, tradeType, {
        ...config,
        blockNumber,
    });
    if (!bestRoutes || bestRoutes.outputAmount.equalTo(0)) {
        throw new Error('Cannot find a valid swap route');
    }

    const { routes, gasEstimateInUSD, gasEstimate, inputAmount, outputAmount } = bestRoutes;
    // TODO restrict trade type to exact input if routes include one of the old
    // stable swap pools, which only allow to swap with exact input
    return {
        tradeType,
        routes,
        gasEstimate,
        gasEstimateInUSD,
        inputAmount,
        outputAmount,
        blockNumber,
    };
}

interface RouteConfig extends TradeConfig {
    blockNumber?: number;
}

async function getBestRoutes(
    amount: CurrencyAmount<Currency>,
    currency: Currency,
    tradeType: TradeType,
    { maxHops = 3, maxSplits = 4, distributionPercent = 5, poolProvider, quoteProvider, blockNumber, gasPriceWei, allowedPoolTypes, quoterOptimization }: RouteConfig,
): Promise<BestRoutes | null> {
    const isExactIn = tradeType === TradeType.EXACT_INPUT;
    const inputCurrency = isExactIn ? amount.currency : currency;
    const outputCurrency = isExactIn ? currency : amount.currency;

    const candidatePools = await poolProvider?.getCandidatePools({
        currencyA: amount.currency,
        currencyB: currency,
        blockNumber,
        protocols: allowedPoolTypes,
    });

    const baseRoutes = computeAllRoutes(inputCurrency, outputCurrency, candidatePools, maxHops);
    const gasModel = await createGasModel({ gasPriceWei, poolProvider, quoteCurrency: currency, blockNumber });
    const routesWithValidQuote = await getRoutesWithValidQuote({
        amount,
        baseRoutes,
        distributionPercent,
        quoteProvider,
        tradeType,
        blockNumber,
        gasModel,
        quoterOptimization,
    });
    // routesWithValidQuote.forEach(({ percent, path, amount: a, quote, pools }) => {
    //     const pathStr = path.map((t) => t.symbol).join('->');
    //     const pathPools = pools.map((pool) => `${pool.fee / 10000}%`).join('->');
    //     console.log(`${percent}% Swap`, a.toExact(), a.currency.symbol, 'through', pathStr, ':', quote.toExact(), quote.currency.symbol, pathPools);
    // });
    return getBestRouteCombinationByQuotes(amount, currency, routesWithValidQuote, tradeType, { maxSplits });
}
