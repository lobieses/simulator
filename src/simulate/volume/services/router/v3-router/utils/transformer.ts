import { ChainId, CurrencyAmount, Currency, Token, Ether, TradeType } from '@real-wagmi/sdk';
import { Address, zeroAddress } from 'viem';
import { Pool, PoolType, Route, SmartRouterTrade, V3Pool } from '../types';
import { isV3Pool } from './pool';

interface SerializedCurrency {
    address: Address;
    decimals: number;
    symbol: string;
}

interface SerializedCurrencyAmount {
    currency: SerializedCurrency;
    value: string;
}

interface SerializedV3Pool extends Omit<V3Pool, 'token0' | 'token1' | 'liquidity' | 'sqrtRatioX96'> {
    token0: SerializedCurrency;
    token1: SerializedCurrency;
    liquidity: string;
    sqrtRatioX96: string;
}

type SerializedPool = SerializedV3Pool;

interface SerializedRoute extends Omit<Route, 'pools' | 'path' | 'input' | 'output' | 'inputAmount' | 'outputAmount'> {
    pools: SerializedPool[];
    path: SerializedCurrency[];
    inputAmount: SerializedCurrencyAmount;
    outputAmount: SerializedCurrencyAmount;
}

interface SerializedTrade extends Omit<SmartRouterTrade<TradeType>, 'inputAmount' | 'outputAmount' | 'gasEstimate' | 'gasEstimateInUSD' | 'routes'> {
    inputAmount: SerializedCurrencyAmount;
    outputAmount: SerializedCurrencyAmount;
    gasEstimate: string;
    gasEstimateInUSD: SerializedCurrencyAmount;
    routes: SerializedRoute[];
}

export function serializeCurrency(currency: Currency): SerializedCurrency {
    return {
        address: currency.isNative ? zeroAddress : currency.wrapped.address,
        decimals: currency.decimals,
        symbol: currency.symbol ?? '',
    };
}

export function serializeCurrencyAmount(amount: CurrencyAmount<Currency>): SerializedCurrencyAmount {
    return {
        currency: serializeCurrency(amount.currency),
        value: amount.quotient.toString(),
    };
}

export function serializePool(pool: Pool): SerializedPool {
    if (isV3Pool(pool)) {
        return {
            ...pool,
            token0: serializeCurrency(pool.token0),
            token1: serializeCurrency(pool.token1),
            liquidity: pool.liquidity.toString(),
            sqrtRatioX96: pool.sqrtRatioX96.toString(),
        };
    }
    throw new Error('Cannot serialize unsupoorted pool');
}

export function serializeRoute(route: Route): SerializedRoute {
    return {
        ...route,
        pools: route.pools.map(serializePool),
        path: route.path.map(serializeCurrency),
        inputAmount: serializeCurrencyAmount(route.inputAmount),
        outputAmount: serializeCurrencyAmount(route.outputAmount),
    };
}

export function serializeTrade(trade: SmartRouterTrade<TradeType>): SerializedTrade {
    return {
        ...trade,
        inputAmount: serializeCurrencyAmount(trade.inputAmount),
        outputAmount: serializeCurrencyAmount(trade.outputAmount),
        routes: trade.routes.map(serializeRoute),
        gasEstimate: trade.gasEstimate.toString(),
        gasEstimateInUSD: serializeCurrencyAmount(trade.gasEstimateInUSD),
    };
}

export function parseCurrency(chainId: ChainId, currency: SerializedCurrency): Currency {
    if (currency.address === zeroAddress) {
        return Ether.onChain(chainId);
    }
    const { address, decimals, symbol } = currency;
    return new Token(chainId, address, decimals, symbol);
}

export function parseCurrencyAmount(chainId: ChainId, amount: SerializedCurrencyAmount): CurrencyAmount<Currency> {
    return CurrencyAmount.fromRawAmount(parseCurrency(chainId, amount.currency), amount.value);
}

export function parsePool(chainId: ChainId, pool: SerializedPool): Pool {
    if (pool.type === PoolType.V3) {
        return {
            ...pool,
            token0: parseCurrency(chainId, pool.token0),
            token1: parseCurrency(chainId, pool.token1),
            liquidity: BigInt(pool.liquidity),
            sqrtRatioX96: BigInt(pool.sqrtRatioX96),
        };
    }

    throw new Error('Cannot parse unsupoorted pool');
}

export function parseRoute(chainId: ChainId, route: SerializedRoute): Route {
    return {
        ...route,
        pools: route.pools.map((p) => parsePool(chainId, p)),
        path: route.path.map((c) => parseCurrency(chainId, c)),
        inputAmount: parseCurrencyAmount(chainId, route.inputAmount),
        outputAmount: parseCurrencyAmount(chainId, route.outputAmount),
    };
}

export function parseTrade(chainId: ChainId, trade: SerializedTrade): SmartRouterTrade<TradeType> {
    return {
        ...trade,
        inputAmount: parseCurrencyAmount(chainId, trade.inputAmount),
        outputAmount: parseCurrencyAmount(chainId, trade.outputAmount),
        routes: trade.routes.map((r) => parseRoute(chainId, r)),
        gasEstimate: BigInt(trade.gasEstimate),
        gasEstimateInUSD: parseCurrencyAmount(chainId, trade.gasEstimateInUSD),
    };
}
