import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IndexingService } from './indexing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('indexing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('indexing')
export class IndexingController {
  constructor(private readonly indexing: IndexingService) {}

  @Get('stats')
  stats() {
    return this.indexing.getQueueStats();
  }

  @Get('jobs')
  jobs(@Query('limit') limit = '20') {
    return this.indexing.getRecentJobs(Number(limit));
  }
}
