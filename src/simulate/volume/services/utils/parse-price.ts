import { Price, Token } from '@real-wagmi/sdk';
const JSBI = require('jsbi');

export default function (baseToken: Token, quoteToken: Token, value: string) {
    const [whole, fraction] = value.split('.');

    const decimals = fraction?.length ?? 0;
    const withoutDecimals = JSBI.BigInt((whole ?? '') + (fraction ?? ''));

    return new Price(
        baseToken,
        quoteToken,
        JSBI.multiply(JSBI.BigInt(10 ** decimals), JSBI.BigInt(10 ** baseToken.decimals)).toString(),
        JSBI.multiply(withoutDecimals, JSBI.BigInt(10 ** quoteToken.decimals)).toString(),
    );
}
