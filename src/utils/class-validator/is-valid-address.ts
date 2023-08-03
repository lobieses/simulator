import { isAddress } from '../is-address';

import { ValidatorType, wrapValidator } from './validator.wrapper';

export function IsValidAddress(): ValidatorType {
    return wrapValidator('isValidAddress', (value) => (Array.isArray(value) ? !value.map((v) => isAddress(v)).includes(false) : isAddress(value)), {
        message: () => 'Invalid address',
    });
}
