import { Injectable } from '@nestjs/common';

@Injectable()
export class GraphGqlService {
    public getBlockNumberByTimestamp(timestamp: number): string {
        return `{
            blocks(
              where: {timestamp_lte: "${timestamp}"}
              orderBy: timestamp
              orderDirection: desc
              first: 1
            ) {
              number
              timestamp
            }
          }`;
    }
}
