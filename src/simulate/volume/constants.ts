import { Token } from '@real-wagmi/sdk';
import { Networks } from '../../blockchain/constants';

export const QUEUE_NAME = 'volume-simulator';
export const PROCESS_NAME = 'simulate';

class AddressCache {
    private _address: string;

    public set address(value: string) {
        this._address = value;
    }

    public get address() {
        return this._address;
    }
}

export const QUOTER_V2_ADDRESS = new AddressCache();

export const V3_CORE_FACTORY_ADDRESS = new AddressCache();

export const TEST_ACCOUNT = {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
};

export const WETH9 = {
    [Networks.MAINNET]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    [Networks.FANTOM]: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    [Networks.BNB]: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};

const WFTM_FANTOM = new Token(Networks.FANTOM, '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', 18, 'WFTM', 'WFTM');
const WETH_MAINNET = new Token(Networks.MAINNET, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 18, 'WETH', 'WETH');
const WBNB_BNB = new Token(Networks.BNB, '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', 18, 'WBNB', 'WBNB');

export const WRAPPED_NATIVE_CURRENCY: { [chainId: number]: Token | undefined } = {
    [Networks.FANTOM]: WFTM_FANTOM,
    [Networks.MAINNET]: WETH_MAINNET,
    [Networks.BNB]: WBNB_BNB,
};

export const USDC_FANTOM_TOKEN = new Token(Networks.FANTOM, '0x04068da6c83afcfa0e13ba15a6696662335d5b75', 6, 'USDC', 'USD//C');
export const USDC_MAINNET_TOKEN = new Token(Networks.MAINNET, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6, 'USDC', 'USD//C');
export const USDC_BNB_TOKEN = new Token(Networks.BNB, '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 18, 'USDC', 'USD//C');

export const usdGasTokensByChain: { [chainId in Networks]?: Token[] } = {
    [Networks.FANTOM]: [USDC_FANTOM_TOKEN],
    [Networks.BNB]: [USDC_BNB_TOKEN],
    [Networks.MAINNET]: [USDC_MAINNET_TOKEN],
};
