import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PolicyModule } from '../policy/policy.module';
import { IndexingModule } from '../indexing/indexing.module';

@Module({
  imports: [PolicyModule, IndexingModule],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
