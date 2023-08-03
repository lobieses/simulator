import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDefined, IsIn, IsNumber, IsNumberString, IsOptional, IsString, Min } from 'class-validator';

import { FiltersDto } from '../../../common/dto/filters.dto';
import { IsValidAddress } from '../../../utils/class-validator';
import { Protocol } from '../../../blockchain/constants';

export class SimulateVolumeV2Dto extends FiltersDto {
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
        required: true,
        type: String,
        description: 'Token 0 wallet',
    })
    @IsDefined()
    @IsString()
    @IsValidAddress()
    public token0Wallet: string;

    @ApiProperty({
        required: true,
        type: String,
        description: 'Token 1 wallet',
    })
    @IsDefined()
    @IsString()
    @IsValidAddress()
    public token1Wallet: string;

    @ApiProperty({
        required: true,
        enum: [Protocol.V3, Protocol.V2],
        description: 'Protocol',
    })
    @IsNumber()
    @IsIn([Protocol.V3, Protocol.V2])
    public protocol: Protocol;

    @ApiProperty({
        required: false,
        type: Number,
        description: 'From timestamp',
    })
    @IsDefined()
    @IsNumber()
    @Min(1)
    public fromTimestamp: number;

    @ApiProperty({
        required: false,
        type: Number,
        description: 'To timestamp',
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    public toTimestamp: number;

    @ApiProperty({
        required: true,
        type: Array,
        description: 'Initial deposit percentages',
    })
    @IsDefined()
    @IsArray()
    public initialPercentage: number[][];

    @ApiProperty({
        required: false,
        type: String,
        description: 'Token 0 liquidity',
    })
    @IsOptional()
    @IsNumberString()
    public token0Liquidity?: string;

    @ApiProperty({
        required: false,
        type: String,
        description: 'Token 1 liquidity',
    })
    @IsOptional()
    @IsNumberString()
    public token1Liquidity?: string;
}
