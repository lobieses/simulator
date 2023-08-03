import { getAddress } from 'ethers/lib/utils';

export function isAddress(address: string): boolean {
    try {
        getAddress(address);
        return true;
    } catch (error) {}
    return false;
}
