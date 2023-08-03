import { Currency, CurrencyAmount } from '@real-wagmi/sdk';

export interface GasCost {
    gasEstimate: bigint;
    // The gas cost in terms of the quote token.
    gasCostInToken: CurrencyAmount<Currency>;
    gasCostInUSD: CurrencyAmount<Currency>;
}
