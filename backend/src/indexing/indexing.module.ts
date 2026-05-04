import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { IndexingService } from './indexing.service';
import { IndexingProcessor } from './indexing.processor';
import { IndexingController } from './indexing.controller';

export const INDEXING_QUEUE = 'indexing';

@Module({
  imports: [
    BullModule.registerQueue({ name: INDEXING_QUEUE }),
    HttpModule,
  ],
  providers: [IndexingService, IndexingProcessor],
  controllers: [IndexingController],
  exports: [IndexingService],
})
export class IndexingModule {}
