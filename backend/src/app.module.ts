import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StoragesModule } from './storages/storages.module';
import { EventsModule } from './events/events.module';
import { PolicyModule } from './policy/policy.module';
import { IndexingModule } from './indexing/indexing.module';
import { IndexRouterModule } from './index-router/index-router.module';
import { LlmModule } from './llm/llm.module';
import { QueryModule } from './query/query.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' }),

    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.APP_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        redis: {
          host: cfg.get('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),

    HttpModule.register({ timeout: 30000, maxRedirects: 3 }),

    PrismaModule,
    AuthModule,
    UsersModule,
    StoragesModule,
    EventsModule,
    PolicyModule,
    IndexingModule,
    IndexRouterModule,
    LlmModule,
    QueryModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
