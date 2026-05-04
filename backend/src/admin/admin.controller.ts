import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService, RegisterAgentDto } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.getDashboard();
  }

  @Get('agents')
  getAgents() {
    return this.admin.getAgents();
  }

  @Post('agents')
  @Roles(UserRole.SUPER_ADMIN)
  registerAgent(@Body() dto: RegisterAgentDto) {
    return this.admin.registerAgent(dto);
  }

  @Post('agents/:id/ping')
  pingAgent(@Param('id') id: string) {
    return this.admin.pingAgent(id);
  }

  @Get('query-logs')
  queryLogs() {
    return this.admin.getQueryLogs();
  }
}
