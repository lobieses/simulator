import { Currency, Price, Token } from '@real-wagmi/sdk';
import { Pool as SDKV3Pool } from '@real-wagmi/v3-sdk';
import { computePoolAddress } from '../utils/compute-pool-address';
import * as memoize from 'lodash/memoize';
import { Address } from 'viem';
import { Pool, PoolType, V3Pool } from '../types';

export function isV3Pool(pool: Pool): pool is V3Pool {
    return pool.type === PoolType.V3;
}

export function involvesCurrency(pool: Pool, currency: Currency) {
    const token = currency.wrapped;
    if (isV3Pool(pool)) {
        const { token0, token1 } = pool;
        return token0.equals(token) || token1.equals(token);
    }
    return false;
}

// FIXME current verison is not working with stable pools that have more than 2 tokens
export function getOutputCurrency(pool: Pool, currencyIn: Currency): Currency {
    const tokenIn = currencyIn.wrapped;
    if (isV3Pool(pool)) {
        const { token0, token1 } = pool;
        return token0.equals(tokenIn) ? token1 : token0;
    }
    throw new Error('Cannot get output currency by invalid pool');
}

export const computeV3PoolAddress = memoize(
    computePoolAddress,
    ({ chainId, tokenA, tokenB, fee }) => `${tokenA.chainId}_${chainId}_${tokenA.wrapped.address}_${tokenB.wrapped.address}_${fee}`,
);

export const getPoolAddress = memoize(
    function getAddress(pool: Pool): Address | '' {
        if (isV3Pool(pool)) {
            return pool.address;
        }
        return '';
    },
    (pool) => {
        const [token0, token1, fee] = [pool.token0.wrapped, pool.token1.wrapped, pool.fee];
        return `${pool.type}_${token0.chainId}_${token0.address}_${token1.address}_${fee}`;
    },
);

export function getTokenPrice(pool: Pool, base: Currency, quote: Currency): Price<Token, Token> {
    if (isV3Pool(pool)) {
        const { token0, token1, fee, liquidity, sqrtRatioX96, tick } = pool;
        const v3Pool = new SDKV3Pool(token0.wrapped, token1.wrapped, fee, sqrtRatioX96.toString(), liquidity.toString(), tick);
        return v3Pool.priceOf(base.wrapped);
    }

    return new Price(base.wrapped, quote.wrapped, '1', '0');
}
