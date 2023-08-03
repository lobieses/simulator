import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { getUrl } from './constants';
import { Networks } from '../blockchain/constants';
import { Observable, map, from, mergeMap } from 'rxjs';
import { IOhlcv, IOhlcvRequestResponse } from './types';
import { sleep } from '../utils/sleep';

@Injectable()
export class GeckoTerminalService {
    constructor(private readonly httpService: HttpService) {}

    public getPoolOhlcvs(network: Networks, poolAddress: string, timestamp?: number): Observable<IOhlcv[]> {
        const url = getUrl(network, poolAddress, timestamp);
        return from(sleep(2000)).pipe(
            mergeMap(() => this.httpService.get<IOhlcvRequestResponse>(url)),
            map(({ data }) =>
                data.data.attributes.ohlcv_list.map(([timestamp, open, high, low, close, volume]) => ({
                    timestamp,
                    open,
                    high,
                    low,
                    close,
                    volume,
                })),
            ),
        );
    }
}
