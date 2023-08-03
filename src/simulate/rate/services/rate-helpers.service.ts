import { Injectable } from '@nestjs/common';
import { IOhlcv } from '../../../gecko-terminal/types';
import { getPercentChange } from '../../../utils';
import { FeeAmount } from '@real-wagmi/v3-sdk';

export interface IRangePrice {
    lowPrice: number;
    highPrice: number;
    volume: number;
}

export interface IRange {
    change: number;
    [FeeAmount.LOW]: IRangePrice;
    [FeeAmount.MEDIUM]: IRangePrice;
    [FeeAmount.HIGH]: {
        upper: IRangePrice;
        lower: IRangePrice;
    };
}

@Injectable()
export class RateHelpersService {
    public calculateRange(data: IOhlcv[]): IRange {
        const result: IRange = {
            change: 0,
            [FeeAmount.LOW]: {
                lowPrice: 0,
                highPrice: 0,
                volume: 0,
            },
            [FeeAmount.MEDIUM]: {
                lowPrice: 0,
                highPrice: 0,
                volume: 0,
            },
            [FeeAmount.HIGH]: {
                upper: {
                    lowPrice: 0,
                    highPrice: 0,
                    volume: 0,
                },
                lower: {
                    lowPrice: 0,
                    highPrice: 0,
                    volume: 0,
                },
            },
        };

        const totalVolume = data.reduce((acc, { volume }) => acc + Number(volume), 0);

        for (const { high, low } of data) {
            if (result[FeeAmount.LOW].lowPrice === 0 || +low < result[FeeAmount.LOW].lowPrice) {
                result[FeeAmount.LOW].lowPrice = +low;
            }
            if (result[FeeAmount.LOW].highPrice === 0 || +high > result[FeeAmount.LOW].highPrice) {
                result[FeeAmount.LOW].highPrice = +high;
            }
        }

        result.change = getPercentChange(result[FeeAmount.LOW].highPrice, result[FeeAmount.LOW].lowPrice);

        const mid = (result[FeeAmount.LOW].highPrice + result[FeeAmount.LOW].lowPrice) / 2;
        const lowMid = mid - (mid - result[FeeAmount.LOW].lowPrice) / 2;
        const highMid = mid + (result[FeeAmount.LOW].highPrice - mid) / 2;

        result[FeeAmount.MEDIUM].highPrice = highMid;
        result[FeeAmount.MEDIUM].lowPrice = lowMid;

        result[FeeAmount.HIGH].upper.highPrice = result[FeeAmount.LOW].highPrice;
        result[FeeAmount.HIGH].upper.lowPrice = highMid;

        result[FeeAmount.HIGH].lower.highPrice = lowMid;
        result[FeeAmount.HIGH].lower.lowPrice = result[FeeAmount.LOW].lowPrice;

        for (const { volume, low, high } of data) {
            const midPrice = (Number(low) + Number(high)) / 2;
            if (midPrice > result[FeeAmount.LOW].lowPrice && result[FeeAmount.LOW].highPrice > midPrice) {
                result[FeeAmount.LOW].volume += Number(volume);
            }

            if (midPrice > result[FeeAmount.MEDIUM].lowPrice && result[FeeAmount.MEDIUM].highPrice > midPrice) {
                result[FeeAmount.MEDIUM].volume += Number(volume);
            }

            if (midPrice > result[FeeAmount.HIGH].upper.lowPrice && result[FeeAmount.HIGH].upper.highPrice > midPrice) {
                result[FeeAmount.HIGH].upper.volume += Number(volume);
            }

            if (midPrice > result[FeeAmount.HIGH].lower.lowPrice && result[FeeAmount.HIGH].lower.highPrice > midPrice) {
                result[FeeAmount.HIGH].lower.volume += Number(volume);
            }
        }

        result[FeeAmount.LOW].volume = (result[FeeAmount.LOW].volume * 100) / totalVolume;
        result[FeeAmount.MEDIUM].volume = (result[FeeAmount.MEDIUM].volume * 100) / totalVolume;
        result[FeeAmount.HIGH].upper.volume = (result[FeeAmount.HIGH].upper.volume * 100) / totalVolume;
        result[FeeAmount.HIGH].lower.volume = (result[FeeAmount.HIGH].lower.volume * 100) / totalVolume;

        return result;
    }
}
