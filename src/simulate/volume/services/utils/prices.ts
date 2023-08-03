import { BigNumber } from 'ethers';

const Q192 = BigNumber.from(2).pow(192);

export function token0Price(sqrtPriceX96: BigNumber, decimals: BigNumber): BigNumber {
    return sqrtPriceX96.mul(sqrtPriceX96).mul(BigNumber.from(10).pow(decimals)).div(Q192);
}

export function token1Price(sqrtPriceX96: BigNumber, decimals: BigNumber): BigNumber {
    return Q192.mul(BigNumber.from(10).pow(decimals)).div(sqrtPriceX96.mul(sqrtPriceX96));
}

export function quote0(sqrtPriceX96: BigNumber, amount: BigNumber): BigNumber {
    return sqrtPriceX96.mul(sqrtPriceX96).mul(amount).div(Q192);
}

export function quote1(sqrtPriceX96: BigNumber, amount: BigNumber): BigNumber {
    return Q192.mul(amount).div(sqrtPriceX96.mul(sqrtPriceX96));
}
