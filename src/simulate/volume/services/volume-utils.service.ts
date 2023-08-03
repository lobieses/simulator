import { Injectable } from '@nestjs/common';
import { PublicClient, HttpTransport, Chain, Address, WalletClient, TestClient, createWalletClient, http, getContract, parseAbi } from 'viem';
import { abi as ERC20Abi } from '../../../blockchain/abi/Tokens/ERC20.json';
import { BigNumber, constants, ethers } from 'ethers';
import * as NonfungiblePositionManager from '../../../blockchain/abi/NonfungiblePositionManager.json';
import { INonfungiblePositionManager } from '../../../typechain/NonfungiblePositionManager';
import { Networks } from '../../../blockchain/constants';
import parseTick from './utils/parse-tick';
import { FeeAmount } from '@real-wagmi/v3-sdk';
import { CurrencyAmount, Token } from '@real-wagmi/sdk';
import { TEST_ACCOUNT, WRAPPED_NATIVE_CURRENCY, usdGasTokensByChain } from '../constants';
import { token0Price, token1Price } from './utils/prices';
import { utils } from '@thanpolas/univ3prices';
import * as UniswapV2Pool from '../../../blockchain/abi/UniswapV2Pool.json';
import { Pool, Position } from '@real-wagmi/v3-sdk';
import * as UniswapV3Pool from '../../../blockchain/abi/UniswapV3Pool.json';
import { computePoolAddress } from './router/v3-router/utils/compute-pool-address';

const NATIVE_POOLS = {
    [Networks.MAINNET]: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
    [Networks.BNB]: '0x16b9a82891338f9ba80e2d6970fdda79d1eb0dae',
    [Networks.FANTOM]: '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c',
};

@Injectable()
export class VolumeUtils {
    public async balanceOf(onChainClient: PublicClient<HttpTransport, Chain>, tokenAddress: Address, accountAddress: Address): Promise<bigint> {
        return onChainClient.readContract({
            address: tokenAddress,
            abi: ERC20Abi,
            functionName: 'balanceOf',
            args: [accountAddress],
        }) as Promise<bigint>;
    }

    public async approve(walletClient: WalletClient, tokenAddress: Address, spender: Address): Promise<void> {
        //@ts-ignore
        await walletClient.writeContract({
            address: tokenAddress,
            abi: ERC20Abi,
            functionName: 'approve',
            args: [spender, ethers.constants.MaxUint256],
        });
    }

    public async transfer(
        walletClient: WalletClient,
        onChainClient: PublicClient<HttpTransport, Chain>,
        tokenAddress: Address,
        tokenWallet: Address,
        accountAddress: Address,
    ): Promise<void> {
        const balance = await this.balanceOf(onChainClient, tokenAddress, tokenWallet);
        //@ts-ignore
        await walletClient.writeContract({
            address: tokenAddress,
            abi: ERC20Abi,
            functionName: 'transfer',
            args: [accountAddress, balance],
        });
    }

    public decimals(onChainClient: PublicClient<HttpTransport, Chain>, tokenAddress: Address): Promise<number> {
        return onChainClient.readContract({
            address: tokenAddress,
            abi: ERC20Abi,
            functionName: 'decimals',
        }) as Promise<number>;
    }

    public symbol(onChainClient: PublicClient<HttpTransport, Chain>, tokenAddress: Address): Promise<string> {
        return onChainClient.readContract({
            address: tokenAddress,
            abi: ERC20Abi,
            functionName: 'symbol',
        }) as Promise<string>;
    }

    public async getPool(onChainClient: PublicClient<HttpTransport, Chain>, token0: Address, token1: Address, fee: FeeAmount) {
        const tokenA = new Token(onChainClient.chain.id, token0, await this.decimals(onChainClient, token0));
        const tokenB = new Token(onChainClient.chain.id, token1, await this.decimals(onChainClient, token1));

        const address = computePoolAddress({ tokenA, tokenB, fee });
        const [sqrtPriceX96, tick] = (await onChainClient.readContract({
            address: address,
            abi: UniswapV3Pool.abi,
            functionName: 'slot0',
        })) as any;

        const liquidity = (await onChainClient.readContract({
            address: address,
            abi: UniswapV3Pool.abi,
            functionName: 'liquidity',
        })) as bigint;

        return new Pool(tokenA, tokenB, fee, sqrtPriceX96, liquidity, tick);
    }

    public async deployContract(
        walletClient: WalletClient,
        onChainClient: PublicClient<HttpTransport, Chain>,
        testClient: TestClient<'anvil', HttpTransport, Chain>,
        abi: any,
        bytecode: string,
        args?: any[],
    ): Promise<Address> {
        const hash = await walletClient.deployContract({
            abi,
            //@ts-ignore
            bytecode,
            args,
        });
        await testClient.mine({ blocks: 1 });
        const { contractAddress } = await onChainClient.getTransactionReceipt({ hash });
        return contractAddress;
    }

    public async createPool(walletClient: WalletClient, contractAddress: Address, args: any[]) {
        //@ts-ignore
        await walletClient.writeContract({
            address: contractAddress,
            abi: NonfungiblePositionManager.abi,
            functionName: 'createAndInitializePoolIfNecessary',
            args,
        });
    }

    public async mint(walletClient: WalletClient, contractAddress: Address, mintParams: INonfungiblePositionManager.MintParamsStruct) {
        //@ts-ignore
        await walletClient.writeContract({
            address: contractAddress,
            abi: NonfungiblePositionManager.abi,
            functionName: 'mint',
            args: [mintParams],
        });
    }

    public async getToken(
        testClient: TestClient<'anvil', HttpTransport, Chain>,
        onChainClient: PublicClient<HttpTransport, Chain>,
        tokenWallet: Address,
        tokenAddress: Address,
    ): Promise<Token> {
        await testClient.impersonateAccount({ address: tokenWallet });
        await testClient.setBalance({ address: tokenWallet, value: 1000000000000000000000000000n });
        const walletClient = createWalletClient({ chain: onChainClient.chain, transport: http(), account: tokenWallet as Address });
        await this.transfer(walletClient, onChainClient, tokenAddress, tokenWallet, TEST_ACCOUNT.address as Address);
        await testClient.stopImpersonatingAccount({ address: tokenWallet });
        const decimals = await this.decimals(onChainClient, tokenAddress);
        const symbol = await this.symbol(onChainClient, tokenAddress);
        return new Token(onChainClient.chain.id, tokenAddress as Address, decimals, symbol, symbol);
    }

    public async createNativePool(
        testClient: TestClient<'anvil', HttpTransport, Chain>,
        onChainClient: PublicClient<HttpTransport, Chain>,
        walletClient: WalletClient,
        npmAddress: Address,
        network: Chain,
    ) {
        const [_reserve0, _reserve1] = (await onChainClient.readContract({
            address: NATIVE_POOLS[network.id],
            abi: UniswapV2Pool,
            functionName: 'getReserves',
        })) as bigint[];
        const sqrtPrice = utils.encodeSqrtRatioX96(_reserve1.toString(), _reserve0.toString()).toString();
        const [token0, token1] = WRAPPED_NATIVE_CURRENCY[network.id].sortsBefore(usdGasTokensByChain[network.id][0])
            ? [WRAPPED_NATIVE_CURRENCY[network.id], usdGasTokensByChain[network.id][0]]
            : [usdGasTokensByChain[network.id][0], WRAPPED_NATIVE_CURRENCY[network.id]];

        await this.createPool(walletClient, npmAddress, [token0.address, token1.address, FeeAmount.LOW, sqrtPrice]);

        await this.getToken(testClient, onChainClient, NATIVE_POOLS[network.id], token0.address);
        await this.getToken(testClient, onChainClient, NATIVE_POOLS[network.id], token1.address);

        await this.approve(walletClient, token0.address, npmAddress);
        await this.approve(walletClient, token1.address, npmAddress);

        const price0 = token0Price(BigNumber.from(sqrtPrice), BigNumber.from(token0.decimals));
        const price1 = token1Price(BigNumber.from(sqrtPrice), BigNumber.from(token1.decimals));

        const lowerLimit = price0.sub(price0.mul(5).div(100));
        const upperLimit = price0.add(price0.mul(5).div(100));

        const lowTickLower = parseTick(token0, token1, FeeAmount.LOW, CurrencyAmount.fromRawAmount(token1, lowerLimit.toString()).toExact());
        const lowTickUpper = parseTick(token0, token1, FeeAmount.LOW, CurrencyAmount.fromRawAmount(token1, upperLimit.toString()).toExact());

        await this.mint(walletClient, npmAddress, {
            token0: token0.address,
            token1: token1.address,
            fee: FeeAmount.LOW,
            tickLower: BigNumber.from(lowTickLower),
            tickUpper: BigNumber.from(lowTickUpper),
            amount0Desired: price1,
            amount1Desired: BigNumber.from(1).mul(BigNumber.from(10).pow(token1.decimals)),
            amount0Min: constants.Zero,
            amount1Min: constants.Zero,
            recipient: TEST_ACCOUNT.address,
            deadline: constants.MaxUint256,
        });
    }

    public async burnLiquidity(
        onChainClient: PublicClient<HttpTransport, Chain>,
        walletClient: WalletClient,
        npmAddress: Address,
        token0: Token,
        token1: Token,
    ): Promise<bigint[]> {
        const amount0Before = await this.balanceOf(onChainClient, token0.address, TEST_ACCOUNT.address as Address);
        const amount1Before = await this.balanceOf(onChainClient, token1.address, TEST_ACCOUNT.address as Address);

        let collect0 = 0n;
        let collect1 = 0n;

        const balance = (await onChainClient.readContract({
            address: npmAddress,
            abi: NonfungiblePositionManager.abi,
            functionName: 'balanceOf',
            args: [TEST_ACCOUNT.address],
        })) as bigint;

        for (let i = 0; i < +balance.toString(); i++) {
            const id = (await onChainClient.readContract({
                address: npmAddress,
                abi: NonfungiblePositionManager.abi,
                functionName: 'tokenOfOwnerByIndex',
                args: [TEST_ACCOUNT.address, BigInt(i)],
            })) as bigint;

            const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);

            const [, , , , , , , liquidity] = (await onChainClient.readContract({
                address: npmAddress,
                abi: NonfungiblePositionManager.abi,
                functionName: 'positions',
                args: [id],
            })) as any;

            //@ts-ignore
            const collect = await onChainClient.simulateContract({
                address: npmAddress,
                abi: NonfungiblePositionManager.abi,
                functionName: 'collect',
                args: [
                    {
                        tokenId: id,
                        recipient: TEST_ACCOUNT.address,
                        amount0Max: MAX_UINT128,
                        amount1Max: MAX_UINT128,
                    },
                ],
            });

            collect0 = collect0 + collect.result[0];
            collect1 = collect1 + collect.result[1];

            //@ts-ignore
            await walletClient.writeContract({
                address: npmAddress,
                abi: NonfungiblePositionManager.abi,
                functionName: 'decreaseLiquidity',
                args: [
                    {
                        tokenId: id,
                        liquidity: liquidity,
                        amount0Min: constants.Zero,
                        amount1Min: constants.Zero,
                        deadline: constants.MaxUint256,
                    },
                ],
            });
            //@ts-ignore
            await walletClient.writeContract({
                address: npmAddress,
                abi: NonfungiblePositionManager.abi,
                functionName: 'collect',
                args: [
                    {
                        tokenId: id,
                        recipient: TEST_ACCOUNT.address,
                        amount0Max: MAX_UINT128,
                        amount1Max: MAX_UINT128,
                    },
                ],
            });
        }

        const amount0After = await this.balanceOf(onChainClient, token0.address, TEST_ACCOUNT.address as Address);
        const amount1After = await this.balanceOf(onChainClient, token1.address, TEST_ACCOUNT.address as Address);

        return [amount0After - amount0Before, amount1After - amount1Before, collect0, collect1];
    }

    public async npmBalanceOf(onChainClient: PublicClient<HttpTransport, Chain>, npmAddress: Address): Promise<bigint> {
        return (await onChainClient.readContract({
            address: npmAddress,
            abi: NonfungiblePositionManager.abi,
            functionName: 'balanceOf',
            args: [TEST_ACCOUNT.address],
        })) as bigint;
    }

    public async tokenOfOwnerByIndex(onChainClient: PublicClient<HttpTransport, Chain>, npmAddress: Address, index: bigint): Promise<bigint> {
        return (await onChainClient.readContract({
            address: npmAddress,
            abi: NonfungiblePositionManager.abi,
            functionName: 'tokenOfOwnerByIndex',
            args: [TEST_ACCOUNT.address, index],
        })) as bigint;
    }

    public async removeLiquidityFromPool(
        onChainClient: PublicClient<HttpTransport, Chain>,
        walletClient: WalletClient,
        npmAddress: Address,
        tickLower: bigint,
        tickUpper: bigint,
        token0Amount: bigint,
        token1Amount: bigint,
    ): Promise<void> {
        if (token0Amount === 0n && token1Amount === 0n) {
            return;
        }

        const balance = await this.npmBalanceOf(onChainClient, npmAddress);

        for (let i = 0; i < +balance.toString(); i++) {
            const id = await this.tokenOfOwnerByIndex(onChainClient, npmAddress, BigInt(i));

            const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);

            const [, , token0, token1, fee, _tickLower, _tickUpper] = (await onChainClient.readContract({
                address: npmAddress,
                abi: NonfungiblePositionManager.abi,
                functionName: 'positions',
                args: [id],
            })) as any;

            if (_tickLower === tickLower && _tickUpper === tickUpper) {
                const pool = await this.getPool(onChainClient, token0, token1, fee);
                const position = Position.fromAmounts({
                    pool,
                    tickLower: Number(tickLower),
                    tickUpper: Number(tickUpper),
                    amount0: token0Amount,
                    amount1: token1Amount,
                    useFullPrecision: false,
                });
                //@ts-ignore
                await walletClient.writeContract({
                    address: npmAddress,
                    abi: NonfungiblePositionManager.abi,
                    functionName: 'decreaseLiquidity',
                    args: [
                        {
                            tokenId: id,
                            liquidity: position.liquidity,
                            amount0Min: token0Amount,
                            amount1Min: token1Amount,
                            deadline: constants.MaxUint256,
                        },
                    ],
                });
                //@ts-ignore
                await walletClient.writeContract({
                    address: npmAddress,
                    abi: NonfungiblePositionManager.abi,
                    functionName: 'collect',
                    args: [
                        {
                            tokenId: id,
                            recipient: TEST_ACCOUNT.address,
                            amount0Max: MAX_UINT128,
                            amount1Max: MAX_UINT128,
                        },
                    ],
                });
            }
        }
    }
}
