import { Hex, encodePacked } from 'viem';
import { Token } from '@real-wagmi/sdk';

import { BaseRoute, Pool } from '../types';
import { getOutputCurrency } from './pool';

/**
 * Converts a route to a hex encoded path
 * @param route the mixed path to convert to an encoded path
 * @returns the encoded path
 */
export function encodeMixedRouteToPath(route: BaseRoute, exactOutput: boolean): Hex {
    const firstInputToken: Token = route.input.wrapped;

    const { path, types } = route.pools.reduce(
        (
            // eslint-disable-next-line @typescript-eslint/no-shadow
            { inputToken, path, types }: { inputToken: Token; path: (string | number)[]; types: string[] },
            pool: Pool,
            index,
        ): { inputToken: Token; path: (string | number)[]; types: string[] } => {
            const outputToken = getOutputCurrency(pool, inputToken).wrapped;
            if (index === 0) {
                return {
                    inputToken: outputToken,
                    types: ['address', 'uint24', 'address'],
                    path: [inputToken.address, pool.fee, outputToken.address],
                };
            }
            return {
                inputToken: outputToken,
                types: [...types, 'uint24', 'address'],
                path: [...path, pool.fee, outputToken.address],
            };
        },
        { inputToken: firstInputToken, path: [], types: [] },
    );

    return exactOutput ? encodePacked(types.reverse(), path.reverse()) : encodePacked(types, path);
}
