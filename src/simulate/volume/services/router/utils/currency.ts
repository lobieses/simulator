import { ChainId, Currency, CurrencyAmount, WETH9, Token, Ether } from '@real-wagmi/sdk';

export function wrappedCurrency(currency: Currency | undefined, chainId: ChainId): Token | undefined {
    return currency?.isNative ? WETH9[chainId] : currency?.isToken ? currency : undefined;
}

export function wrappedCurrencyAmount(currencyAmount: CurrencyAmount<Currency> | undefined, chainId: ChainId | undefined): CurrencyAmount<Token> | undefined {
    const token = currencyAmount && chainId ? wrappedCurrency(currencyAmount.currency, chainId) : undefined;
    return token && currencyAmount ? CurrencyAmount.fromRawAmount(token, currencyAmount.quotient) : undefined;
}

export function unwrappedToken(token: Currency): Currency {
    if (token.isNative) {
        return token;
    }

    if (token.equals(WETH9[token.chainId])) return Ether.onChain(token.chainId);
    return token;
}
