import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EventsService, StorageEventDto } from './events.service';

@ApiTags('events')
@Controller('internal/events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly cfg: ConfigService,
  ) {}

  // Called by storage agents — authenticated via shared AGENT_SECRET header
  @Post('storage')
  @ApiOperation({ summary: 'Receive storage event from agent (internal)' })
  async receive(
    @Headers('x-agent-secret') secret: string,
    @Body() dto: StorageEventDto,
  ) {
    const expected = this.cfg.get<string>('AGENT_SECRET', 'dev-agent-secret');
    if (secret !== expected) throw new UnauthorizedException('Invalid agent secret');
    return this.events.handleStorageEvent(dto);
  }
}
