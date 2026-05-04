import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QueryService, QueryDto } from './query.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('query')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('query')
export class QueryController {
  constructor(private readonly query: QueryService) {}

  @Post()
  ask(@Body() dto: QueryDto, @CurrentUser() user: any) {
    return this.query.answer(dto, user);
  }

  @Get('history')
  history(@CurrentUser() user: any, @Query('limit') limit = '20') {
    return this.query.getHistory(user.id, Number(limit));
  }
}
