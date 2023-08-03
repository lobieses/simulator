import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber } from 'class-validator';

import { availableNetworks, Networks } from '../../blockchain/constants';

export class FiltersDto {
    @ApiProperty({
        required: true,
        enum: availableNetworks,
        description: 'Network id',
    })
    @IsNumber()
    @IsIn(availableNetworks)
    public network: Networks;
}
