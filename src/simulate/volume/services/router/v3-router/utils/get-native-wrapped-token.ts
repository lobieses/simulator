import { ChainId, Token } from '@real-wagmi/sdk';

import { nativeWrappedTokenByChain } from '../../constants';

export function getNativeWrappedToken(chainId: ChainId): Token | null {
    return nativeWrappedTokenByChain[chainId] ?? null;
}
