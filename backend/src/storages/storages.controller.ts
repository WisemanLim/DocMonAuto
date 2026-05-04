import { Controller, Get, Post, Delete, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { StoragesService, CreateStorageDto } from './storages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('storages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('storages')
export class StoragesController {
  constructor(private readonly storages: StoragesService) {}

  @Get()
  findAll() {
    return this.storages.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storages.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateStorageDto) {
    return this.storages.create(dto);
  }

  @Patch(':id/active')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.storages.setActive(id, isActive);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.storages.delete(id);
  }
}
