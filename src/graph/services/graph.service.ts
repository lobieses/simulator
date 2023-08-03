import { Injectable } from '@nestjs/common';
import { GraphGqlService } from './graph-gql.service';
import { GraphHelpersService } from './graph-helpers.service';
import { Networks } from '../../blockchain/constants';
import { HttpService } from '@nestjs/axios';
import { Observable, map } from 'rxjs';

@Injectable()
export class GraphService {
    constructor(private readonly httpService: HttpService, private readonly graphGqlService: GraphGqlService, private readonly graphHelpersService: GraphHelpersService) {}

    public getBlockNumberByTimestamp(network: Networks, timestamp: number): Observable<number> {
        const query = this.graphGqlService.getBlockNumberByTimestamp(timestamp);
        const url = this.graphHelpersService.getBlockUrl(network);
        return this.httpService.post(url, { query }).pipe(map(({ data }) => Number(data?.data?.blocks[0]?.number ?? 0)));
    }
}
