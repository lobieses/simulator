import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNumber, IsOptional, IsString } from 'class-validator';

import { FiltersDto } from '../../../common/dto/filters.dto';
import { IsValidAddress } from '../../../utils/class-validator';

export class SimulateRateDto extends FiltersDto {
    @ApiProperty({
        required: true,
        type: String,
        description: 'Pool address',
    })
    @IsDefined()
    @IsString()
    @IsValidAddress()
    public poolAddress: string;

    @ApiProperty({
        required: false,
        type: Number,
        description: 'Timestamp',
    })
    @IsOptional()
    @IsNumber()
    public timestamp?: number;
}
