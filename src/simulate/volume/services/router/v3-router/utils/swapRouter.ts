import { encodeFunctionData, Hex, Address } from 'viem';
import { Currency, CurrencyAmount, Percent, TradeType, validateAndParseAddress } from '@real-wagmi/sdk';
import { FeeOptions, MethodParameters, Payments, PermitOptions, SelfPermit, toHex } from '@real-wagmi/v3-sdk';
import * as invariant from 'tiny-invariant';

import { swapRouter02Abi } from '../../abis/ISwapRouter02';
import { ADDRESS_THIS, MSG_SENDER } from '../../constants';
import { SmartRouterTrade, V3Pool } from '../types';
import { MulticallExtended, Validation } from './multicallExtended';
import { PaymentsExtended } from './paymentsExtended';
import { encodeMixedRouteToPath } from './encode-mixed-route-to-path';
import { maximumAmountIn, minimumAmountOut } from './maximum-amount';
import { getPriceImpact } from './getPriceImpact';

const ZERO = 0n;
const REFUND_ETH_PRICE_IMPACT_THRESHOLD = new Percent(50n, 100n);

/**
 * Options for producing the arguments to send calls to the router.
 */
export interface SwapOptions {
    /**
     * How much the execution price is allowed to move unfavorably from the trade execution price.
     */
    slippageTolerance: Percent;

    /**
     * The account that should receive the output. If omitted, output is sent to msg.sender.
     */
    recipient?: Address;

    /**
     * Either deadline (when the transaction expires, in epoch seconds), or previousBlockhash.
     */
    deadlineOrPreviousBlockhash?: Validation;

    /**
     * The optional permit parameters for spending the input.
     */
    inputTokenPermit?: PermitOptions;

    /**
     * Optional information for taking a fee on output.
     */
    fee?: FeeOptions;
}

export interface SwapAndAddOptions extends SwapOptions {
    /**
     * The optional permit parameters for pulling in remaining output token.
     */
    outputTokenPermit?: PermitOptions;
}

type AnyTradeType = SmartRouterTrade<TradeType> | SmartRouterTrade<TradeType>[];

/**
 * Represents the Pancakeswap V2 + V3 + StableSwap SwapRouter02, and has static methods for helping execute trades.
 */
export abstract class SwapRouter {
    public static ABI = swapRouter02Abi;

    /**
     * Cannot be constructed.
     */
    // eslint-disable-next-line no-useless-constructor, @typescript-eslint/no-empty-function
    private constructor() {}

    /**
     * @notice Generates the calldata for a Swap with a V3 Route.
     * @param trade The V3Trade to encode.
     * @param options SwapOptions to use for the trade.
     * @param routerMustCustody Flag for whether funds should be sent to the router
     * @param performAggregatedSlippageCheck Flag for whether we want to perform an aggregated slippage check
     * @returns A string array of calldatas for the trade.
     */
    private static encodeV3Swap(trade: SmartRouterTrade<TradeType>, options: SwapOptions, routerMustCustody: boolean, performAggregatedSlippageCheck: boolean): Hex[] {
        const calldatas: Hex[] = [];

        for (const route of trade.routes) {
            const { inputAmount, outputAmount, pools, path } = route;
            const amountIn: bigint = maximumAmountIn(trade, options.slippageTolerance, inputAmount).quotient;
            const amountOut: bigint = minimumAmountOut(trade, options.slippageTolerance, outputAmount).quotient;

            // flag for whether the trade is single hop or not
            const singleHop = pools.length === 1;

            const recipient = routerMustCustody ? ADDRESS_THIS : typeof options.recipient === 'undefined' ? MSG_SENDER : validateAndParseAddress(options.recipient);

            if (singleHop) {
                if (trade.tradeType === TradeType.EXACT_INPUT) {
                    const exactInputSingleParams = {
                        tokenIn: path[0].wrapped.address,
                        tokenOut: path[1].wrapped.address,
                        fee: (pools[0] as V3Pool).fee,
                        recipient,
                        amountIn,
                        amountOutMinimum: performAggregatedSlippageCheck ? 0n : amountOut,
                        sqrtPriceLimitX96: 0n,
                    };

                    calldatas.push(
                        encodeFunctionData({
                            abi: SwapRouter.ABI,
                            functionName: 'exactInputSingle',
                            args: [exactInputSingleParams],
                        }),
                    );
                } else {
                    const exactOutputSingleParams = {
                        tokenIn: path[0].wrapped.address,
                        tokenOut: path[1].wrapped.address,
                        fee: (pools[0] as V3Pool).fee,
                        recipient,
                        amountOut,
                        amountInMaximum: amountIn,
                        sqrtPriceLimitX96: 0n,
                    };

                    calldatas.push(
                        encodeFunctionData({
                            abi: SwapRouter.ABI,
                            functionName: 'exactOutputSingle',
                            args: [exactOutputSingleParams],
                        }),
                    );
                }
            } else {
                const pathStr = encodeMixedRouteToPath({ ...route, input: inputAmount.currency, output: outputAmount.currency }, trade.tradeType === TradeType.EXACT_OUTPUT);

                if (trade.tradeType === TradeType.EXACT_INPUT) {
                    const exactInputParams = {
                        path: pathStr,
                        recipient,
                        amountIn,
                        amountOutMinimum: performAggregatedSlippageCheck ? 0n : amountOut,
                    };

                    calldatas.push(
                        encodeFunctionData({
                            abi: SwapRouter.ABI,
                            functionName: 'exactInput',
                            args: [exactInputParams],
                        }),
                    );
                } else {
                    const exactOutputParams = {
                        path: pathStr,
                        recipient,
                        amountOut,
                        amountInMaximum: amountIn,
                    };

                    calldatas.push(
                        encodeFunctionData({
                            abi: SwapRouter.ABI,
                            functionName: 'exactOutput',
                            args: [exactOutputParams],
                        }),
                    );
                }
            }
        }

        return calldatas;
    }

    private static encodeSwaps(
        anyTrade: AnyTradeType,
        options: SwapOptions,
        isSwapAndAdd?: boolean,
    ): {
        calldatas: Hex[];
        sampleTrade: SmartRouterTrade<TradeType>;
        routerMustCustody: boolean;
        inputIsNative: boolean;
        outputIsNative: boolean;
        totalAmountIn: CurrencyAmount<Currency>;
        minimumAmountOut: CurrencyAmount<Currency>;
        quoteAmountOut: CurrencyAmount<Currency>;
    } {
        const trades = !Array.isArray(anyTrade) ? [anyTrade] : anyTrade;

        const numberOfTrades = trades.reduce((numOfTrades, trade) => numOfTrades + trade.routes.length, 0);

        const sampleTrade = trades[0];

        // All trades should have the same starting/ending currency and trade type
        //@ts-ignore
        invariant(
            trades.every((trade) => trade.inputAmount.currency.equals(sampleTrade.inputAmount.currency)),
            'TOKEN_IN_DIFF',
        );
        //@ts-ignore
        invariant(
            trades.every((trade) => trade.outputAmount.currency.equals(sampleTrade.outputAmount.currency)),
            'TOKEN_OUT_DIFF',
        );
        //@ts-ignore
        invariant(
            trades.every((trade) => trade.tradeType === sampleTrade.tradeType),
            'TRADE_TYPE_DIFF',
        );

        const calldatas: Hex[] = [];

        const inputIsNative = sampleTrade.inputAmount.currency.isNative;
        const outputIsNative = sampleTrade.outputAmount.currency.isNative;

        // flag for whether we want to perform an aggregated slippage check
        //   1. when there are >2 exact input trades. this is only a heuristic,
        //      as it's still more gas-expensive even in this case, but has benefits
        //      in that the reversion probability is lower
        const performAggregatedSlippageCheck = sampleTrade.tradeType === TradeType.EXACT_INPUT && numberOfTrades > 2;
        // flag for whether funds should be send first to the router
        //   1. when receiving ETH (which much be unwrapped from WETH)
        //   2. when a fee on the output is being taken
        //   3. when performing swap and add
        //   4. when performing an aggregated slippage check
        const routerMustCustody = outputIsNative || !!options.fee || !!isSwapAndAdd || performAggregatedSlippageCheck;

        // encode permit if necessary
        if (options.inputTokenPermit) {
            //@ts-ignore
            invariant(sampleTrade.inputAmount.currency.isToken, 'NON_TOKEN_PERMIT');
            calldatas.push(SelfPermit.encodePermit(sampleTrade.inputAmount.currency.wrapped, options.inputTokenPermit));
        }

        for (const trade of trades) {
            for (const calldata of SwapRouter.encodeV3Swap(trade, options, routerMustCustody, performAggregatedSlippageCheck)) {
                calldatas.push(calldata);
            }
        }

        const ZERO_IN: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(sampleTrade.inputAmount.currency, 0);
        const ZERO_OUT: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(sampleTrade.outputAmount.currency, 0);

        const minAmountOut: CurrencyAmount<Currency> = trades.reduce((sum, trade) => sum.add(minimumAmountOut(trade, options.slippageTolerance)), ZERO_OUT);

        const quoteAmountOut: CurrencyAmount<Currency> = trades.reduce((sum, trade) => sum.add(trade.outputAmount), ZERO_OUT);

        const totalAmountIn: CurrencyAmount<Currency> = trades.reduce((sum, trade) => sum.add(maximumAmountIn(trade, options.slippageTolerance)), ZERO_IN);

        return {
            calldatas,
            sampleTrade,
            routerMustCustody,
            inputIsNative,
            outputIsNative,
            totalAmountIn,
            minimumAmountOut: minAmountOut,
            quoteAmountOut,
        };
    }

    /**
     * Produces the on-chain method name to call and the hex encoded parameters to pass as arguments for a given trade.
     * @param trades to produce call parameters for
     * @param options options for the call parameters
     */
    public static swapCallParameters(trades: AnyTradeType, options: SwapOptions): MethodParameters {
        const { calldatas, sampleTrade, routerMustCustody, inputIsNative, outputIsNative, totalAmountIn, minimumAmountOut: minAmountOut } = SwapRouter.encodeSwaps(trades, options);

        // unwrap or sweep
        if (routerMustCustody) {
            if (outputIsNative) {
                calldatas.push(PaymentsExtended.encodeUnwrapWETH9(minAmountOut.quotient, options.recipient, options.fee));
            } else {
                calldatas.push(PaymentsExtended.encodeSweepToken(sampleTrade.outputAmount.currency.wrapped, minAmountOut.quotient, options.recipient, options.fee));
            }
        }

        // must refund when paying in ETH: either with an uncertain input amount OR if there's a chance of a partial fill.
        // unlike ERC20's, the full ETH value must be sent in the transaction, so the rest must be refunded.
        if (inputIsNative && (sampleTrade.tradeType === TradeType.EXACT_OUTPUT || SwapRouter.riskOfPartialFill(trades))) {
            calldatas.push(Payments.encodeRefundETH());
        }

        return {
            calldata: MulticallExtended.encodeMulticall(calldatas, options.deadlineOrPreviousBlockhash),
            value: toHex(inputIsNative ? totalAmountIn.quotient : ZERO),
        };
    }

    // if price impact is very high, there's a chance of hitting max/min prices resulting in a partial fill of the swap
    private static riskOfPartialFill(trades: AnyTradeType): boolean {
        if (Array.isArray(trades)) {
            return trades.some((trade) => {
                return SwapRouter.v3TradeWithHighPriceImpact(trade);
            });
        }
        return SwapRouter.v3TradeWithHighPriceImpact(trades);
    }

    private static v3TradeWithHighPriceImpact(trade: SmartRouterTrade<TradeType>): boolean {
        return getPriceImpact(trade).greaterThan(REFUND_ETH_PRICE_IMPACT_THRESHOLD);
    }
}
