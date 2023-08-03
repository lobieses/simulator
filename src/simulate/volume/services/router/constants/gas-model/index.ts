import { Token } from '@real-wagmi/sdk';
import { Networks } from '../../../../../../blockchain/constants';
import { WRAPPED_NATIVE_CURRENCY } from '../../../../constants';

export const nativeWrappedTokenByChain: { [chainId in Networks]?: Token } = {
    [Networks.FANTOM]: WRAPPED_NATIVE_CURRENCY[Networks.FANTOM],
    [Networks.BNB]: WRAPPED_NATIVE_CURRENCY[Networks.BNB],
    [Networks.MAINNET]: WRAPPED_NATIVE_CURRENCY[Networks.MAINNET],
};
