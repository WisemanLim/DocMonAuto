import { Module } from '@nestjs/common';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { PolicyModule } from '../policy/policy.module';
import { IndexRouterModule } from '../index-router/index-router.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [PolicyModule, IndexRouterModule, LlmModule],
  providers: [QueryService],
  controllers: [QueryController],
})
export class QueryModule {}
