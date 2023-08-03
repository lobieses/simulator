import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { Networks, Protocol } from '../../../blockchain/constants';
import { mainnet } from 'viem/chains';
import { createPublicClient, createTestClient, http, Chain, createWalletClient, Address, zeroAddress, PublicClient, HttpTransport, TestClient, decodeFunctionData } from 'viem';
import { ethersModules } from '../../../blockchain/constants';
import { CurrencyAmount, Percent, Token, TradeType } from '@real-wagmi/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { Log } from '@ethersproject/abstract-provider';
import * as UniswapV3Factory from '../../../blockchain/abi/UniswapV3Factory.json';
import * as ProxyAdmin from '../../../blockchain/abi/ProxyAdmin.json';
import { V3_CORE_FACTORY_ADDRESS, QUOTER_V2_ADDRESS, TEST_ACCOUNT, WETH9 } from '../constants';
import { LoggerService } from '../../../logger/logger.service';
import * as Quoter from '../../../blockchain/abi/Quoter.json';
import * as QuoterV2 from '../../../blockchain/abi/QuoterV2.json';
import * as NFTDescriptor from '../../../blockchain/abi/NFTDescriptor.json';
import * as NonfungibleTokenPositionDescriptor from '../../../blockchain/abi/NonfungibleTokenPositionDescriptor.json';
import * as TransparentUpgradeableProxy from '../../../blockchain/abi/TransparentUpgradeableProxy.json';
import { ethers, BigNumber, constants } from 'ethers';
import * as NonfungiblePositionManager from '../../../blockchain/abi/NonfungiblePositionManager.json';
import * as SwapRouter02 from '../../../blockchain/abi/SwapRouter02.json';
import { FeeAmount, SwapOptions, TICK_SPACINGS, nearestUsableTick } from '@real-wagmi/v3-sdk';
import { quote0, token0Price, quote1 } from './utils/prices';
import parseTick from './utils/parse-tick';
import { VolumeUtils } from './volume-utils.service';
import * as Multicall from '../../../blockchain/abi/Multicall.json';
import * as UniswapV2Pool from '../../../blockchain/abi/UniswapV2Pool.json';
import * as UniswapV3Pool from '../../../blockchain/abi/UniswapV3Pool.json';
import { SmartRouter } from './router';
import { computeTradePriceBreakdown } from './utils/compute-trade-breakdown';
import { SwapRouter } from './router/v3-router/utils/swapRouter';

global.fetch = fetch;

const IMulticall = new ethers.utils.Interface(Multicall.abi);

@Injectable()
export class VolumeHelpers {
    constructor(private readonly loggerService: LoggerService, private readonly volumeUtils: VolumeUtils) {}

    public async createConnect(network: Networks, rpcId: string) {
        const chain = {
            ...mainnet,
            id: network as number,
            rpcUrls: {
                default: {
                    http: [`http://${rpcId}:8545`],
                    webSocket: [`ws://${rpcId}:8545`],
                },
                public: {
                    http: [`http://${rpcId}:8545`],
                    webSocket: [`ws://${rpcId}:8545`],
                },
            },
        };

        const testClient = createTestClient({
            chain,
            mode: 'anvil',
            transport: http(),
        });
        const jsonRpcUrl = ethersModules.find((module) => module.network === network).custom as string;
        await testClient.reset({ jsonRpcUrl }).catch((e) => console.log('errorr ', e));
        await testClient.setAutomine(true);
        const onChainClient = createPublicClient({
            chain,
            transport: http(),
        });
        return { testClient, onChainClient, chain };
    }

    public async simulate(
        testClient: TestClient<'anvil', HttpTransport, Chain>,
        onChainClient: PublicClient<HttpTransport, Chain>,
        chain: Chain,
        poolAddress: Address,
        token0: Token,
        token1: Token,
        logs: Log[],
        initialSqrtPrice: bigint,
        initialPriceChange: number,
        protocol: Protocol,
        initialPercentage: number[],
        token0Liquidity?: string,
        token1Liquidity?: string,
    ) {
        const liquidityExist = !!(token0Liquidity && token1Liquidity);
        const inter = new ethers.utils.Interface(protocol === Protocol.V2 ? UniswapV2Pool : UniswapV3Pool.abi);
        const stat = {
            initial: {
                total: {
                    token0: 0n,
                    token1: 0n,
                },
                low: {
                    token0: 0n,
                    token1: 0n,
                    tickLower: 0n,
                    tickUpper: 0n,
                    convertad: 0n,
                },
                medium: {
                    token0: 0n,
                    token1: 0n,
                    tickLower: 0n,
                    tickUpper: 0n,
                    convertad: 0n,
                },
                lower: {
                    token0: 0n,
                    token1: 0n,
                    tickLower: 0n,
                    tickUpper: 0n,
                    convertad: 0n,
                },
                upper: {
                    token0: 0n,
                    token1: 0n,
                    tickLower: 0n,
                    tickUpper: 0n,
                    convertad: 0n,
                },
            },
            collect: {
                token0: 0n,
                token1: 0n,
            },
            end: {
                token0: 0n,
                token1: 0n,
            },
            convertT1: {
                start: 0n,
                end: 0n,
            },
            convertT0: {
                start: 0n,
                end: 0n,
            },
            parsed: {
                current: 0,
                total: logs.length,
                failted: 0,
            },
        };
        const account = privateKeyToAccount(TEST_ACCOUNT.privateKey as Address);
        const walletClient = createWalletClient({
            chain,
            account,
            transport: http(),
        });

        let token0ForLiquidity: bigint;
        let token1ForLiquidity: bigint;

        if (liquidityExist) {
            token0ForLiquidity = BigInt(token0Liquidity);
            token1ForLiquidity = BigInt(token1Liquidity);
        } else {
            const poolToken0Balance = await this.volumeUtils.balanceOf(onChainClient, token0.address, poolAddress);
            const poolToken1Balance = await this.volumeUtils.balanceOf(onChainClient, token1.address, poolAddress);
            token0ForLiquidity = poolToken0Balance / 100n;
            token1ForLiquidity = poolToken1Balance / 100n;
        }

        const factoryAddress = await this.volumeUtils.deployContract(walletClient, onChainClient, testClient, UniswapV3Factory.abi, UniswapV3Factory.bytecode);
        V3_CORE_FACTORY_ADDRESS.address = factoryAddress;
        this.loggerService.info(`v3 factory deployed: ${factoryAddress}`);

        const proxyAddress = await this.volumeUtils.deployContract(walletClient, onChainClient, testClient, ProxyAdmin.abi, ProxyAdmin.bytecode);
        this.loggerService.info(`proxy admin deployed: ${proxyAddress}`);

        const quoterAddress = await this.volumeUtils.deployContract(walletClient, onChainClient, testClient, Quoter.abi, Quoter.bytecode, [factoryAddress, WETH9[chain.id]]);
        this.loggerService.info(`quoter deployed: ${quoterAddress}`);

        const quoterV2Address = await this.volumeUtils.deployContract(walletClient, onChainClient, testClient, QuoterV2.abi, QuoterV2.bytecode, [factoryAddress, WETH9[chain.id]]);
        QUOTER_V2_ADDRESS.address = quoterV2Address;
        this.loggerService.info(`quoter v2 deployed: ${quoterV2Address}`);

        const NFTDescriptorAddress = await this.volumeUtils.deployContract(walletClient, onChainClient, testClient, NFTDescriptor.abi, NFTDescriptor.bytecode);
        this.loggerService.info(`NFTDescriptor deployed: ${NFTDescriptorAddress}`);

        const NonfungibleTokenPositionDescriptorAddress = await this.volumeUtils.deployContract(
            walletClient,
            onChainClient,
            testClient,
            NonfungibleTokenPositionDescriptor.abi,
            NonfungibleTokenPositionDescriptor.bytecode,
            [WETH9[chain.id], NFTDescriptorAddress],
        );
        this.loggerService.info(`NonfungibleTokenPositionDescriptor deployed: ${NonfungibleTokenPositionDescriptorAddress}`);

        const TransparentUpgradeableProxyAddress = await this.volumeUtils.deployContract(
            walletClient,
            onChainClient,
            testClient,
            TransparentUpgradeableProxy.abi,
            TransparentUpgradeableProxy.bytecode,
            [NonfungibleTokenPositionDescriptorAddress, proxyAddress, ethers.utils.arrayify('0x')],
        );
        this.loggerService.info(`TransparentUpgradeableProxy deployed: ${TransparentUpgradeableProxyAddress}`);

        const NonfungiblePositionManagerAddress = await this.volumeUtils.deployContract(
            walletClient,
            onChainClient,
            testClient,
            NonfungiblePositionManager.abi,
            NonfungiblePositionManager.bytecode,
            [factoryAddress, WETH9[chain.id], TransparentUpgradeableProxyAddress],
        );
        this.loggerService.info(`NonfungiblePositionManager deployed: ${NonfungiblePositionManagerAddress}`);

        const SwapRouter02Address = await this.volumeUtils.deployContract(walletClient, onChainClient, testClient, SwapRouter02.abi, SwapRouter02.bytecode, [
            zeroAddress,
            factoryAddress,
            NonfungiblePositionManagerAddress,
            WETH9[chain.id],
        ]);
        this.loggerService.info(`SwapRouter02 deployed: ${SwapRouter02Address}`);

        for (const address of [NonfungiblePositionManagerAddress, SwapRouter02Address]) {
            await this.volumeUtils.approve(walletClient, token0.address, address);
            await this.volumeUtils.approve(walletClient, token1.address, address);
        }
        this.loggerService.info('token approve');

        const pools: { fee: FeeAmount; poolAddress: Address }[] = [];

        for (const fee of [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]) {
            await this.volumeUtils.createPool(walletClient, NonfungiblePositionManagerAddress, [token0.address, token1.address, fee, initialSqrtPrice]);
            const poolAddress = (await onChainClient.readContract({
                address: factoryAddress,
                abi: UniswapV3Factory.abi,
                functionName: 'getPool',
                args: [token0.address, token1.address, fee],
            })) as Address;
            pools.push({
                fee,
                poolAddress,
            });
            this.loggerService.info(`Pool was created ${token0.symbol}/${token1.symbol} ${fee} | ${poolAddress}`);
        }
        this.loggerService.info('createAndInitializePoolIfNecessary');
        await this.volumeUtils.createNativePool(testClient, onChainClient, walletClient, NonfungiblePositionManagerAddress, chain);
        this.loggerService.info('createNativePool');
        const priceChange = Math.round(initialPriceChange / 2);

        const addLiquidity = async (token0: CurrencyAmount<Token>, token1: CurrencyAmount<Token>, percentages: number[]) => {
            const price0 = token0Price(BigNumber.from(initialSqrtPrice.toString()), BigNumber.from(token0.currency.decimals));
            const lowerLimit = price0.sub(price0.mul(priceChange).div(100));
            const upperLimit = price0.add(price0.mul(priceChange).div(100));

            const lowTickLower = parseTick(token0.currency, token1.currency, FeeAmount.LOW, CurrencyAmount.fromRawAmount(token1.currency, lowerLimit.toString()).toExact());
            const lowTickUpper = parseTick(token0.currency, token1.currency, FeeAmount.LOW, CurrencyAmount.fromRawAmount(token1.currency, upperLimit.toString()).toExact());

            const wasAdded = {
                [FeeAmount.LOW]: {
                    token0: 0n,
                    token1: 0n,
                },
                [FeeAmount.MEDIUM]: {
                    token0: 0n,
                    token1: 0n,
                },
                [FeeAmount.HIGH]: {
                    upper: {
                        token0: 0n,
                        token1: 0n,
                    },
                    lower: {
                        token0: 0n,
                        token1: 0n,
                    },
                },
            };

            if (percentages[0] > 0) {
                const amount0Before = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const amount1Before = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);
                await this.volumeUtils.mint(walletClient, NonfungiblePositionManagerAddress, {
                    token0: token0.currency.address,
                    token1: token1.currency.address,
                    fee: FeeAmount.LOW,
                    tickLower: BigNumber.from(lowTickLower),
                    tickUpper: BigNumber.from(lowTickUpper),
                    amount0Desired: BigNumber.from(token0.quotient.toString()).mul(percentages[0]).div(100),
                    amount1Desired: BigNumber.from(token1.quotient.toString()).mul(percentages[0]).div(100),
                    amount0Min: constants.Zero,
                    amount1Min: constants.Zero,
                    recipient: TEST_ACCOUNT.address,
                    deadline: constants.MaxUint256,
                });
                this.loggerService.info('add liquidity to low');

                const amount0After = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const amount1After = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);

                const amount0Def = amount0Before - amount0After;
                const amount1Def = amount1Before - amount1After;

                stat.initial.total.token0 = stat.initial.total.token0 + amount0Def;
                stat.initial.total.token1 = stat.initial.total.token1 + amount1Def;

                stat.initial.low.token0 = stat.initial.low.token0 + amount0Def;
                stat.initial.low.token1 = stat.initial.low.token1 + amount1Def;

                stat.initial.low.tickLower = BigInt(lowTickLower);
                stat.initial.low.tickUpper = BigInt(lowTickUpper);

                wasAdded[FeeAmount.LOW].token0 = amount0Def;
                wasAdded[FeeAmount.LOW].token1 = amount1Def;
            }

            const lowerHighTickLower = nearestUsableTick(lowTickLower, TICK_SPACINGS[FeeAmount.HIGH]);
            const lowerHighTickUpper = lowerHighTickLower + TICK_SPACINGS[FeeAmount.HIGH];

            const upperHighTickUpper = nearestUsableTick(lowTickUpper, TICK_SPACINGS[FeeAmount.HIGH]);
            const upperHighTickLower = upperHighTickUpper - TICK_SPACINGS[FeeAmount.HIGH];

            if (percentages[2] > 0) {
                const lowerAmount0Before = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const lowerAmount1Before = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);

                await this.volumeUtils.mint(walletClient, NonfungiblePositionManagerAddress, {
                    token0: token0.currency.address,
                    token1: token1.currency.address,
                    fee: FeeAmount.HIGH,
                    tickLower: BigNumber.from(lowerHighTickLower),
                    tickUpper: BigNumber.from(lowerHighTickUpper),
                    amount0Desired: BigNumber.from(token0.quotient.toString()).mul(percentages[2]).div(100),
                    amount1Desired: BigNumber.from(token1.quotient.toString()).mul(percentages[2]).div(100),
                    amount0Min: constants.Zero,
                    amount1Min: constants.Zero,
                    recipient: TEST_ACCOUNT.address,
                    deadline: constants.MaxUint256,
                });

                this.loggerService.info('add liquidity to lower');

                const lowerAmount0After = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const lowerAmount1After = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);

                const lowerAmount0Def = lowerAmount0Before - lowerAmount0After;
                const lowerAmount1Def = lowerAmount1Before - lowerAmount1After;

                stat.initial.total.token0 = stat.initial.total.token0 + lowerAmount0Def;
                stat.initial.total.token1 = stat.initial.total.token1 + lowerAmount1Def;

                stat.initial.lower.token0 = stat.initial.lower.token0 + lowerAmount0Def;
                stat.initial.lower.token1 = stat.initial.lower.token1 + lowerAmount1Def;

                stat.initial.lower.tickLower = BigInt(lowerHighTickLower);
                stat.initial.lower.tickUpper = BigInt(lowerHighTickUpper);

                wasAdded[FeeAmount.HIGH].lower.token0 = lowerAmount0Def;
                wasAdded[FeeAmount.HIGH].lower.token1 = lowerAmount1Def;

                const upperAmount0Before = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const upperAmount1Before = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);

                await this.volumeUtils.mint(walletClient, NonfungiblePositionManagerAddress, {
                    token0: token0.currency.address,
                    token1: token1.currency.address,
                    fee: FeeAmount.HIGH,
                    tickLower: BigNumber.from(upperHighTickLower),
                    tickUpper: BigNumber.from(upperHighTickUpper),
                    amount0Desired: BigNumber.from(token0.quotient.toString()).mul(percentages[2]).div(100),
                    amount1Desired: BigNumber.from(token1.quotient.toString()).mul(percentages[2]).div(100),
                    amount0Min: constants.Zero,
                    amount1Min: constants.Zero,
                    recipient: TEST_ACCOUNT.address,
                    deadline: constants.MaxUint256,
                });

                this.loggerService.info('add liquidity to upper');
                const upperAmount0After = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const upperAmount1After = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);

                const upperAmount0Def = upperAmount0Before - upperAmount0After;
                const upperAmount1Def = upperAmount1Before - upperAmount1After;

                stat.initial.total.token0 = stat.initial.total.token0 + upperAmount0Def;
                stat.initial.total.token1 = stat.initial.total.token1 + upperAmount1Def;

                stat.initial.upper.token0 = stat.initial.upper.token0 + upperAmount0Def;
                stat.initial.upper.token1 = stat.initial.upper.token1 + upperAmount1Def;

                stat.initial.upper.tickLower = BigInt(upperHighTickLower);
                stat.initial.upper.tickUpper = BigInt(upperHighTickUpper);

                wasAdded[FeeAmount.HIGH].upper.token0 = upperAmount0Def;
                wasAdded[FeeAmount.HIGH].upper.token1 = upperAmount1Def;
            }

            if (percentages[1] > 0) {
                const amount0Before = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const amount1Before = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);

                await this.volumeUtils.mint(walletClient, NonfungiblePositionManagerAddress, {
                    token0: token0.currency.address,
                    token1: token1.currency.address,
                    fee: FeeAmount.MEDIUM,
                    tickLower: nearestUsableTick(lowerHighTickUpper, TICK_SPACINGS[FeeAmount.MEDIUM]),
                    tickUpper: nearestUsableTick(upperHighTickLower, TICK_SPACINGS[FeeAmount.MEDIUM]),
                    amount0Desired: BigNumber.from(token0.quotient.toString()).mul(percentages[1]).div(100),
                    amount1Desired: BigNumber.from(token1.quotient.toString()).mul(percentages[1]).div(100),
                    amount0Min: constants.Zero,
                    amount1Min: constants.Zero,
                    recipient: TEST_ACCOUNT.address,
                    deadline: constants.MaxUint256,
                });

                this.loggerService.info('add liquidity to medium');
                const amount0After = await this.volumeUtils.balanceOf(onChainClient, token0.currency.address, TEST_ACCOUNT.address as Address);
                const amount1After = await this.volumeUtils.balanceOf(onChainClient, token1.currency.address, TEST_ACCOUNT.address as Address);

                const amount0Def = amount0Before - amount0After;
                const amount1Def = amount1Before - amount1After;

                stat.initial.total.token0 = stat.initial.total.token0 + amount0Def;
                stat.initial.total.token1 = stat.initial.total.token1 + amount1Def;

                stat.initial.medium.token0 = stat.initial.medium.token0 + amount0Def;
                stat.initial.medium.token1 = stat.initial.medium.token1 + amount1Def;

                stat.initial.medium.tickLower = BigInt(nearestUsableTick(lowerHighTickUpper, TICK_SPACINGS[FeeAmount.MEDIUM]));
                stat.initial.medium.tickUpper = BigInt(nearestUsableTick(upperHighTickLower, TICK_SPACINGS[FeeAmount.MEDIUM]));

                wasAdded[FeeAmount.MEDIUM].token0 = amount0Def;
                wasAdded[FeeAmount.MEDIUM].token1 = amount1Def;
            }

            return wasAdded;
        };

        await addLiquidity(CurrencyAmount.fromRawAmount(token0, token0ForLiquidity), CurrencyAmount.fromRawAmount(token1, token1ForLiquidity), initialPercentage);

        for (let i = 0; i < logs.length; i++) {
            try {
                this.loggerService.info(`Log ${i + 1} from ${logs.length}`);
                const log = logs[i];
                const { name, args } = inter.parseLog(log);
                if (name !== 'Swap') continue;

                let tokenIn: Token;
                let tokenOut: Token;
                let amountIn: BigNumber;

                if (protocol === Protocol.V2) {
                    const { amount0In, amount1In } = args;

                    tokenIn = amount0In.isZero() ? token1 : token0;
                    tokenOut = amount0In.isZero() ? token0 : token1;
                    amountIn = amount0In.isZero() ? amount1In : amount0In;
                } else {
                    const { amount0, amount1 } = args;

                    const zeroForOne = amount0 < ethers.constants.Zero;
                    tokenIn = zeroForOne ? token0 : token1;
                    tokenOut = zeroForOne ? token1 : token0;
                    amountIn = zeroForOne ? amount0.mul(ethers.constants.NegativeOne) : amount1.mul(ethers.constants.NegativeOne);
                }

                const inputAmount = CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString());
                this.loggerService.info(`Try find Swap ${inputAmount.toExact()} ${inputAmount.currency.symbol} -> ${tokenOut.symbol}`);

                const tryRoute = async () => {
                    const pools = await SmartRouter.getV3CandidatePools({
                        currencyA: tokenIn,
                        currencyB: tokenOut,
                        onChainProvider: () => onChainClient,
                    });

                    const trade = await SmartRouter.getBestTrade(inputAmount, tokenOut, TradeType.EXACT_INPUT, {
                        gasPriceWei: await onChainClient.getGasPrice(),
                        poolProvider: SmartRouter.createStaticPoolProvider(pools),
                        quoteProvider: SmartRouter.createQuoteProvider({ onChainProvider: () => onChainClient }),
                    });

                    const { priceImpactWithoutFee } = computeTradePriceBreakdown(trade);

                    return {
                        trade,
                        priceImpactWithoutFee,
                    };
                };

                let { trade, priceImpactWithoutFee } = await tryRoute();

                if (parseFloat(priceImpactWithoutFee.toFixed(2)) > 50) {
                    throw new Error();
                }

                if (parseFloat(priceImpactWithoutFee.toFixed(2)) > 1 && !liquidityExist) {
                    let goodPriceImpact = false;
                    let counter = 0;
                    const wasAdded = [];
                    while (!goodPriceImpact) {
                        if (counter > 5) {
                            for (const [low, medium, high] of wasAdded) {
                                await this.volumeUtils.removeLiquidityFromPool(
                                    onChainClient,
                                    walletClient,
                                    NonfungiblePositionManagerAddress,
                                    stat.initial.low.tickLower,
                                    stat.initial.low.tickUpper,
                                    low.token0,
                                    low.token1,
                                );

                                stat.initial.low.token0 = stat.initial.low.token0 - low.token0;
                                stat.initial.low.token1 = stat.initial.low.token1 - low.token1;

                                stat.initial.total.token0 = stat.initial.total.token0 - low.token0;
                                stat.initial.total.token1 = stat.initial.total.token1 - low.token1;

                                await this.volumeUtils.removeLiquidityFromPool(
                                    onChainClient,
                                    walletClient,
                                    NonfungiblePositionManagerAddress,
                                    stat.initial.medium.tickLower,
                                    stat.initial.medium.tickUpper,
                                    medium.token0,
                                    medium.token1,
                                );
                                stat.initial.medium.token0 = stat.initial.medium.token0 - medium.token0;
                                stat.initial.medium.token1 = stat.initial.medium.token1 - medium.token1;

                                stat.initial.total.token0 = stat.initial.total.token0 - medium.token0;
                                stat.initial.total.token1 = stat.initial.total.token1 - medium.token1;

                                await this.volumeUtils.removeLiquidityFromPool(
                                    onChainClient,
                                    walletClient,
                                    NonfungiblePositionManagerAddress,
                                    stat.initial.upper.tickLower,
                                    stat.initial.upper.tickUpper,
                                    high.upper.token0,
                                    high.upper.token1,
                                );
                                stat.initial.upper.token0 = stat.initial.upper.token0 - high.upper.token0;
                                stat.initial.upper.token1 = stat.initial.upper.token1 - high.upper.token1;

                                stat.initial.total.token0 = stat.initial.total.token0 - high.upper.token0;
                                stat.initial.total.token1 = stat.initial.total.token1 - high.upper.token1;

                                await this.volumeUtils.removeLiquidityFromPool(
                                    onChainClient,
                                    walletClient,
                                    NonfungiblePositionManagerAddress,
                                    stat.initial.lower.tickLower,
                                    stat.initial.lower.tickUpper,
                                    high.lower.token0,
                                    high.lower.token1,
                                );
                                stat.initial.lower.token0 = stat.initial.lower.token0 - high.lower.token0;
                                stat.initial.lower.token1 = stat.initial.lower.token1 - high.lower.token1;

                                stat.initial.total.token0 = stat.initial.total.token0 - high.lower.token0;
                                stat.initial.total.token1 = stat.initial.total.token1 - high.lower.token1;
                            }
                            throw new Error();
                        }
                        const percenteges = [0, 0, 0];

                        for (const route of trade.routes) {
                            const feeAmount = route.pools[0].fee;
                            if (feeAmount === FeeAmount.LOW) {
                                percenteges[0] = route.percent;
                            }
                            if (feeAmount === FeeAmount.MEDIUM) {
                                percenteges[1] = route.percent;
                            }
                            if (feeAmount === FeeAmount.HIGH) {
                                percenteges[2] = route.percent;
                            }
                        }
                        const data = await addLiquidity(
                            CurrencyAmount.fromRawAmount(token0, token0ForLiquidity),
                            CurrencyAmount.fromRawAmount(token1, token1ForLiquidity),
                            percenteges,
                        );
                        counter += 1;
                        const afterDeposit = await tryRoute();
                        this.loggerService.info(
                            `Adding liquidity | low: ${percenteges[0]}, medium:${percenteges[1]}, high: ${percenteges[2]} | was ${priceImpactWithoutFee.toFixed(
                                2,
                            )}% set ${afterDeposit.priceImpactWithoutFee.toFixed(2)}`,
                        );
                        wasAdded.push(data);
                        if (!(parseFloat(afterDeposit.priceImpactWithoutFee.toFixed(2)) > 1)) {
                            trade = afterDeposit.trade;
                            priceImpactWithoutFee = afterDeposit.priceImpactWithoutFee;
                            goodPriceImpact = true;
                        }
                    }
                }

                const options: SwapOptions = {
                    slippageTolerance: new Percent(50, 10_000), // 50 bips, or 0.50%
                    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
                    recipient: TEST_ACCOUNT.address as Address,
                };

                this.loggerService.info(
                    `Swap ${trade.inputAmount.toExact()} ${trade.inputAmount.currency.symbol} -> ${trade.outputAmount.toExact()} ${
                        trade.outputAmount.currency.symbol
                    } | ${priceImpactWithoutFee.toFixed(2)}%`,
                );

                for (const router of trade.routes) {
                    const path = router.pools.map((pool) => pool.fee / 10000).join('->');
                    this.loggerService.info(`${router.percent}% | ${path}`);
                }

                const methodParameters = SwapRouter.swapCallParameters(trade, options);

                if (trade.routes.length > 1) {
                    const multicallData = IMulticall.decodeFunctionData('multicall', methodParameters.calldata);
                    for (const mData of multicallData.data) {
                        const { args } = decodeFunctionData({ abi: SwapRouter.ABI, data: mData });
                        await walletClient.writeContract({
                            address: SwapRouter02Address,
                            abi: SwapRouter.ABI,
                            functionName: 'exactInputSingle',
                            //@ts-ignore
                            args,
                        });
                    }
                } else {
                    const { args } = decodeFunctionData({ abi: SwapRouter.ABI, data: methodParameters.calldata });
                    await walletClient.writeContract({
                        address: SwapRouter02Address,
                        abi: SwapRouter.ABI,
                        functionName: 'exactInputSingle',
                        //@ts-ignore
                        args,
                    });
                }
                stat.parsed.current += 1;
            } catch (err) {
                console.log(err);
                stat.parsed.failted += 1;
            }
        }

        const [liquidityToken0, liquidityToken1, collect0, collect1] = await this.volumeUtils.burnLiquidity(
            onChainClient,
            walletClient,
            NonfungiblePositionManagerAddress,
            token0,
            token1,
        );

        stat.collect.token0 = collect0;
        stat.collect.token1 = collect1;
        stat.end.token0 = liquidityToken0;
        stat.end.token1 = liquidityToken1;

        const slot0: any = await onChainClient.readContract({
            address: pools[0].poolAddress,
            abi: UniswapV3Pool.abi,
            functionName: 'slot0',
        });

        stat.convertT1.start = BigNumber.from(stat.initial.total.token1)
            .add(quote0(BigNumber.from(initialSqrtPrice.toString()), BigNumber.from(stat.initial.total.token0)))
            .toBigInt();

        stat.convertT0.start = BigNumber.from(stat.initial.total.token0)
            .add(quote1(BigNumber.from(initialSqrtPrice.toString()), BigNumber.from(stat.initial.total.token1)))
            .toBigInt();

        stat.initial.low.convertad = BigNumber.from(stat.initial.low.token1)
            .add(quote0(BigNumber.from(initialSqrtPrice.toString()), BigNumber.from(stat.initial.low.token0)))
            .toBigInt();

        stat.initial.medium.convertad = BigNumber.from(stat.initial.medium.token1)
            .add(quote0(BigNumber.from(initialSqrtPrice.toString()), BigNumber.from(stat.initial.medium.token0)))
            .toBigInt();

        stat.initial.lower.convertad = BigNumber.from(stat.initial.lower.token1)
            .add(quote0(BigNumber.from(initialSqrtPrice.toString()), BigNumber.from(stat.initial.lower.token0)))
            .toBigInt();

        stat.initial.upper.convertad = BigNumber.from(stat.initial.upper.token1)
            .add(quote0(BigNumber.from(initialSqrtPrice.toString()), BigNumber.from(stat.initial.upper.token0)))
            .toBigInt();

        stat.convertT1.end = BigNumber.from(stat.end.token1)
            .add(quote0(BigNumber.from(slot0[0].toString()), BigNumber.from(stat.end.token0)))
            .toBigInt();

        stat.convertT0.end = BigNumber.from(stat.end.token0)
            .add(quote1(BigNumber.from(slot0[0].toString()), BigNumber.from(stat.end.token1)))
            .toBigInt();

        return stat;
    }
}
