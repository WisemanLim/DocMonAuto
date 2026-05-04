import { Module } from '@nestjs/common';
import { StoragesService } from './storages.service';
import { StoragesController } from './storages.controller';

@Module({
  providers: [StoragesService],
  controllers: [StoragesController],
  exports: [StoragesService],
})
export class StoragesModule {}
