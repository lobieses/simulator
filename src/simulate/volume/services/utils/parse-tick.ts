import { Token } from '@real-wagmi/sdk';
import parsePrice from './parse-price';
import { FeeAmount, TICK_SPACINGS, TickMath, encodeSqrtRatioX96, nearestUsableTick, priceToClosestTick } from '@real-wagmi/v3-sdk';
const JSBI = require('jsbi');

export default function (baseToken: Token, quoteToken: Token, feeAmount: FeeAmount, value: string) {
    const price = parsePrice(baseToken, quoteToken, value);
    let tick: number;

    // check price is within min/max bounds, if outside return min/max
    const sqrtRatioX96 = encodeSqrtRatioX96(price.numerator, price.denominator);

    if (JSBI.greaterThanOrEqual(JSBI.BigInt(sqrtRatioX96.toString()), JSBI.BigInt(TickMath.MAX_SQRT_RATIO.toString()))) {
        tick = TickMath.MAX_TICK;
    } else if (JSBI.lessThanOrEqual(JSBI.BigInt(sqrtRatioX96.toString()), JSBI.BigInt(TickMath.MIN_SQRT_RATIO.toString()))) {
        tick = TickMath.MIN_TICK;
    } else {
        // this function is agnostic to the base, will always return the correct tick
        tick = priceToClosestTick(price);
    }

    return nearestUsableTick(tick, TICK_SPACINGS[feeAmount]);
}
