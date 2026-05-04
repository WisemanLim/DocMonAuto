import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [HttpModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
