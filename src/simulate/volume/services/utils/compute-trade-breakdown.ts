import { Currency, CurrencyAmount, Percent, Token, TradeType, ZERO } from '@real-wagmi/sdk';
import { SmartRouter, SmartRouterTrade } from '../router';
import { FeeAmount, ONE_HUNDRED_PERCENT } from '@real-wagmi/v3-sdk';

const BIPS_BASE = 10000n;

function v3FeeToPercent(fee: FeeAmount): Percent {
    return new Percent(fee, BIPS_BASE * 100n);
}

export function computeTradePriceBreakdown(trade?: SmartRouterTrade<TradeType> | null): {
    priceImpactWithoutFee?: Percent | null;
    lpFeeAmount?: CurrencyAmount<Currency> | null;
} {
    if (!trade) {
        return {
            priceImpactWithoutFee: undefined,
            lpFeeAmount: null,
        };
    }

    const { routes, outputAmount, inputAmount } = trade;
    let feePercent = new Percent(0);
    let outputAmountWithoutPriceImpact = CurrencyAmount.fromRawAmount(trade.outputAmount.wrapped.currency, 0);
    for (const route of routes) {
        const { inputAmount: routeInputAmount, pools, percent } = route;
        const routeFeePercent = ONE_HUNDRED_PERCENT.subtract(
            pools.reduce<Percent>((currentFee, pool) => {
                if (SmartRouter.isV3Pool(pool)) {
                    return currentFee.multiply(ONE_HUNDRED_PERCENT.subtract(v3FeeToPercent(pool.fee)));
                }
                return currentFee;
            }, ONE_HUNDRED_PERCENT),
        );
        // Not accurate since for stable swap, the lp fee is deducted on the output side
        feePercent = feePercent.add(routeFeePercent.multiply(new Percent(percent, 100)));

        const midPrice = SmartRouter.getMidPrice(route);
        outputAmountWithoutPriceImpact = outputAmountWithoutPriceImpact.add(midPrice.quote(routeInputAmount.wrapped) as CurrencyAmount<Token>);
    }

    if (outputAmountWithoutPriceImpact.quotient === ZERO) {
        return {
            priceImpactWithoutFee: undefined,
            lpFeeAmount: null,
        };
    }

    const priceImpactRaw = outputAmountWithoutPriceImpact.subtract(outputAmount.wrapped).divide(outputAmountWithoutPriceImpact);
    const priceImpactPercent = new Percent(priceImpactRaw.numerator, priceImpactRaw.denominator);
    const priceImpactWithoutFee = priceImpactPercent.subtract(feePercent);
    const lpFeeAmount = inputAmount.multiply(feePercent);

    return {
        priceImpactWithoutFee,
        lpFeeAmount,
    };
}
