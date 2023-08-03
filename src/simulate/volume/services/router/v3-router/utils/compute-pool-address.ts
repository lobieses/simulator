import { Currency } from '@real-wagmi/sdk';
import { FeeAmount } from '@real-wagmi/v3-sdk';
import { V3_CORE_FACTORY_ADDRESS } from '../../../../constants';
import { keccak256, encodeAbiParameters, parseAbiParameters, Address, GetCreate2AddressOptions, toBytes, getAddress, pad, isBytes, Hex, ByteArray, slice, concat } from 'viem';

const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';

interface Props {
    tokenA: Currency;
    tokenB: Currency;
    fee: FeeAmount;
}

function getCreate2Address(from_: GetCreate2AddressOptions['from'], salt_: GetCreate2AddressOptions['salt'], initCodeHash: Hex) {
    const from = toBytes(getAddress(from_));
    const salt = pad(isBytes(salt_) ? salt_ : toBytes(salt_ as Hex), {
        size: 32,
    }) as ByteArray;

    return getAddress(slice(keccak256(concat([toBytes('0xff'), from, salt, toBytes(initCodeHash)])), 12));
}

export function computePoolAddress({ tokenA, tokenB, fee }: Props): Address {
    const [token0, token1] = tokenA.wrapped.sortsBefore(tokenB.wrapped) ? [tokenA, tokenB] : [tokenB, tokenA];
    const salt = keccak256(encodeAbiParameters(parseAbiParameters('address, address, uint24'), [token0.wrapped.address, token1.wrapped.address, fee]));
    return getCreate2Address(V3_CORE_FACTORY_ADDRESS.address as Address, salt, POOL_INIT_CODE_HASH);
}
