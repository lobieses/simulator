import { Module } from '@nestjs/common';
import { GraphService } from './services/graph.service';
import { GraphGqlService } from './services/graph-gql.service';
import { GraphHelpersService } from './services/graph-helpers.service';
import { HttpModule } from '@nestjs/axios';

const PROVIDERS = [GraphService];

@Module({
    imports: [HttpModule],
    providers: [...PROVIDERS, GraphGqlService, GraphHelpersService],
    exports: PROVIDERS,
})
export class GraphModule {}
