import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IndexRouterService } from './index-router.service';

@Module({
  imports: [HttpModule],
  providers: [IndexRouterService],
  exports: [IndexRouterService],
})
export class IndexRouterModule {}
