import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LlmService } from './llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('llm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('llm')
export class LlmController {
  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('providers')
  getProviders() {
    return this.prisma.llmProvider.findMany({ orderBy: { name: 'asc' } });
  }

  @Patch('providers/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  updateProvider(@Param('id') id: string, @Body() body: any) {
    return this.prisma.llmProvider.update({ where: { id }, data: body });
  }
}
