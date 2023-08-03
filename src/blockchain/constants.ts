import { EthersModuleOptions } from 'nestjs-ethers';

import { FTM_RPC, BNB_RPC, ETH_RPC } from '../env';

export enum Networks {
    MAINNET = 1,
    BNB = 56,
    FANTOM = 250,
}

export enum Protocol {
    V2,
    V3,
}

export const SWAP_TOPICS = {
    [Protocol.V3]: '0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83',
    [Protocol.V2]: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
};

export const ethersModules: EthersModuleOptions[] = [
    {
        token: 'ftm',
        network: Networks.FANTOM,
        useDefaultProvider: false,
        custom: FTM_RPC,
    },
    {
        token: 'bnb',
        network: Networks.BNB,
        useDefaultProvider: false,
        custom: BNB_RPC,
    },
    {
        token: 'eth',
        network: Networks.MAINNET,
        useDefaultProvider: false,
        custom: ETH_RPC,
    },
];

export const availableNetworks = [Networks.MAINNET, Networks.FANTOM, Networks.BNB];

export const LOG_STEP = 2000;
