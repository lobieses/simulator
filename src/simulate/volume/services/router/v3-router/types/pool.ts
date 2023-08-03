import { Currency, Percent } from '@real-wagmi/sdk';
import { FeeAmount, Tick } from '@real-wagmi/v3-sdk';
import { Address } from 'viem';

export enum PoolType {
    V3,
}

export interface BasePool {
    type: PoolType;
}

export interface V3Pool extends BasePool {
    type: PoolType.V3;
    token0: Currency;
    token1: Currency;
    // Different fee tier
    fee: FeeAmount;
    liquidity: bigint;
    sqrtRatioX96: bigint;
    tick: number;
    address: Address;

    // Allow pool with no ticks data provided
    ticks?: Tick[];
}

export type Pool = V3Pool;

export interface WithTvl {
    tvlUSD: bigint;
}

export type V3PoolWithTvl = V3Pool & WithTvl;
