import { ChainId } from '@real-wagmi/sdk';
import { encodeFunctionData, PublicClient, decodeFunctionResult } from 'viem';
import * as stats from 'stats-lite';

import IMulticallABI from '../../abis/InterfaceMulticall';
import {
    CallMultipleFunctionsOnSameContractParams,
    CallSameFunctionOnContractWithMultipleParams,
    CallSameFunctionOnMultipleContractsParams,
    IMulticallProvider,
    Result,
} from './multicall-provider';
import { Networks } from '../../../../../../blockchain/constants';

const MULTICALL_ADDRESS = {
    [Networks.FANTOM]: '0xDb51CffFf3B989d0cB6b58AbF173371b6F2d0D24',
    [Networks.BNB]: '0x963Df249eD09c358A4819E39d9Cd5736c3087184',
    [Networks.MAINNET]: '0x1F98415757620B543A52E61c46B32eB19261F984',
};

export type WagmiMulticallConfig = {
    gasLimitPerCallOverride?: number;
};

function isPromise<T>(p: any): p is Promise<T> {
    if (typeof p === 'object' && typeof p.then === 'function') {
        return true;
    }

    return false;
}

export class WagmiMulticallProvider extends IMulticallProvider<WagmiMulticallConfig> {
    static abi = IMulticallABI;

    constructor(protected chainId: ChainId, protected provider: PublicClient, protected gasLimitPerCall = 1_000_000) {
        super();
        const multicallAddress = MULTICALL_ADDRESS[this.chainId];

        if (!multicallAddress) {
            throw new Error(`No address for Wagmi Multicall Contract on chain id: ${chainId}`);
        }

        this.provider = provider;
    }

    public async callSameFunctionOnMultipleContracts<TFunctionParams extends any[] | undefined, TReturn = any>(
        params: CallSameFunctionOnMultipleContractsParams<TFunctionParams>,
    ): Promise<{
        blockNumber: bigint;
        results: Result<TReturn>[];
    }> {
        const { addresses, functionName, functionParams, providerConfig, abi } = params;

        const blockNumberOverride = providerConfig?.blockNumber ?? undefined;

        const callData = encodeFunctionData({
            abi,
            functionName,
            args: functionParams,
        });

        const calls = addresses.map((address) => {
            return {
                target: address,
                callData,
                gasLimit: BigInt(this.gasLimitPerCall),
            };
        });

        // console.log({ calls }, `About to multicall for ${functionName} across ${addresses.length} addresses`)

        const {
            result: [blockNumber, aggregateResults],
        } = await this.provider.simulateContract({
            abi: IMulticallABI,
            address: MULTICALL_ADDRESS[this.chainId],
            functionName: 'multicall',
            args: [calls],
            //@ts-ignore
            blockNumber: blockNumberOverride ? (isPromise(blockNumberOverride) ? BigInt(Number(await blockNumberOverride)) : BigInt(Number(blockNumberOverride))) : undefined,
        });

        // const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls, {
        //   blockTag: blockNumberOverride && JSBI.toNumber(JSBI.BigInt(blockNumberOverride)),
        // })

        const results: Result<TReturn>[] = [];

        for (let i = 0; i < aggregateResults.length; i++) {
            const { success, returnData } = aggregateResults[i]!;

            // Return data "0x" is sometimes returned for invalid calls.
            if (!success || returnData.length <= 2) {
                // console.log(
                //   { result: aggregateResults[i] },
                //   `Invalid result calling ${functionName} on address ${addresses[i]}`,
                // )
                results.push({
                    success: false,
                    returnData,
                });
                continue;
            }

            results.push({
                success: true,
                result: decodeFunctionResult({
                    abi,
                    functionName,
                    data: returnData,
                }) as TReturn,
            });
        }

        // console.log(
        //   { results },
        //   `Results for multicall on ${functionName} across ${addresses.length} addresses as of block ${blockNumber}`,
        // )

        return { blockNumber, results };
    }

    public async callSameFunctionOnContractWithMultipleParams<TFunctionParams extends any[] | undefined, TReturn>(
        params: CallSameFunctionOnContractWithMultipleParams<TFunctionParams, WagmiMulticallConfig>,
    ): Promise<{
        blockNumber: bigint;
        results: Result<TReturn>[];
        approxGasUsedPerSuccessCall: number;
    }> {
        const { address, functionName, functionParams, additionalConfig, providerConfig, abi } = params;

        const gasLimitPerCall = additionalConfig?.gasLimitPerCallOverride ?? this.gasLimitPerCall;
        const blockNumberOverride = providerConfig?.blockNumber ?? undefined;

        const calls = functionParams.map((functionParam) => {
            const callData = encodeFunctionData({
                abi,
                functionName,
                args: functionParam,
            });

            return {
                target: address,
                callData,
                gasLimit: BigInt(gasLimitPerCall),
            };
        });

        // console.log(
        //   { calls },
        //   `About to multicall for ${functionName} at address ${address} with ${functionParams.length} different sets of params`,
        // )

        const {
            result: [blockNumber, aggregateResults],
        } = await this.provider.simulateContract({
            abi: IMulticallABI,
            address: MULTICALL_ADDRESS[this.chainId],
            functionName: 'multicall',
            args: [calls],
            //@ts-ignore
            blockNumber: blockNumberOverride ? BigInt(Number(blockNumberOverride)) : undefined,
        });

        const results: Result<TReturn>[] = [];

        const gasUsedForSuccess: number[] = [];
        for (let i = 0; i < aggregateResults.length; i++) {
            const { success, returnData, gasUsed } = aggregateResults[i]!;

            // Return data "0x" is sometimes returned for invalid pools.
            if (!success || returnData.length <= 2) {
                // console.log(
                //   { result: aggregateResults[i] },
                //   `Invalid result calling ${functionName} with params ${functionParams[i]}`,
                // )
                results.push({
                    success: false,
                    returnData,
                });
                continue;
            }

            gasUsedForSuccess.push(Number(gasUsed));

            results.push({
                success: true,
                result: decodeFunctionResult({
                    abi,
                    functionName,
                    data: returnData,
                }) as TReturn,
            });
        }

        // console.log(
        //   { results, functionName, address },
        //   `Results for multicall for ${functionName} at address ${address} with ${functionParams.length} different sets of params. Results as of block ${blockNumber}`,
        // )
        return {
            blockNumber,
            results,
            approxGasUsedPerSuccessCall: stats.percentile(gasUsedForSuccess, 99),
        };
    }

    public async callMultipleFunctionsOnSameContract<TFunctionParams extends any[] | undefined, TReturn>(
        params: CallMultipleFunctionsOnSameContractParams<TFunctionParams, WagmiMulticallConfig>,
    ): Promise<{
        blockNumber: bigint;
        results: Result<TReturn>[];
        approxGasUsedPerSuccessCall: number;
    }> {
        const { address, functionNames, functionParams, additionalConfig, providerConfig, abi } = params;

        const gasLimitPerCall = additionalConfig?.gasLimitPerCallOverride ?? this.gasLimitPerCall;
        const blockNumberOverride = providerConfig?.blockNumber ?? undefined;

        const calls = functionNames.map((functionName, i) => {
            const callData = encodeFunctionData({
                abi,
                functionName,
                args: functionParams ? functionParams[i] : [],
            });

            return {
                target: address,
                callData,
                gasLimit: BigInt(gasLimitPerCall),
            };
        });

        // console.log(
        //   { calls },
        //   `About to multicall for ${functionNames.length} functions at address ${address} with ${functionParams?.length} different sets of params`,
        // )

        const {
            result: [blockNumber, aggregateResults],
        } = await this.provider.simulateContract({
            abi: IMulticallABI,
            address: MULTICALL_ADDRESS[this.chainId],
            functionName: 'multicall',
            args: [calls],
            //@ts-ignore
            blockNumber: blockNumberOverride ? BigInt(Number(blockNumberOverride)) : undefined,
        });
        // const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls, {
        //   blockTag: blockNumberOverride && JSBI.toNumber(JSBI.BigInt(blockNumberOverride)),
        // })

        const results: Result<TReturn>[] = [];

        const gasUsedForSuccess: number[] = [];
        for (let i = 0; i < aggregateResults.length; i++) {
            const { success, returnData, gasUsed } = aggregateResults[i]!;

            // Return data "0x" is sometimes returned for invalid pools.
            if (!success || returnData.length <= 2) {
                // console.log(
                //   { result: aggregateResults[i] },
                //   `Invalid result calling ${functionNames[i]} with ${functionParams ? functionParams[i] : '0'} params`,
                // )
                results.push({
                    success: false,
                    returnData,
                });
                continue;
            }

            gasUsedForSuccess.push(Number(gasUsed));

            results.push({
                success: true,
                result: decodeFunctionResult({
                    abi,
                    data: returnData,
                    functionName: functionNames[i]!,
                }) as TReturn,
            });
        }

        // console.log(
        //   { results, functionNames, address },
        //   `Results for multicall for ${functionNames.length} functions at address ${address} with ${functionParams ? functionParams.length : ' 0'
        //   } different sets of params. Results as of block ${blockNumber}`,
        // )
        return {
            blockNumber,
            results,
            approxGasUsedPerSuccessCall: stats.percentile(gasUsedForSuccess, 99),
        };
    }
}
