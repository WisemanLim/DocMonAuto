import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AgentStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { hashBcrypt } from '../common/password-hash';
import { IsString, IsOptional } from 'class-validator';

export class RegisterAgentDto {
  @IsString() name: string;
  @IsString() endpoint: string;
  @IsString() secret: string;
  @IsString() @IsOptional() watchPath?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
  ) {}

  async getDashboard() {
    const [storageTotal, activeStorages, documents, indexingJobs, agentsBrief, queriesTodayCount] =
      await Promise.all([
        this.prisma.storage.count(),
        this.prisma.storage.count({ where: { isActive: true } }),
        this.prisma.document.count({ where: { isDeleted: false } }),
        this.prisma.indexingJob.groupBy({ by: ['status'], _count: { status: true } }),
        this.prisma.agent.findMany({ select: { id: true, status: true } }),
        this.prisma.queryLog.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      ]);

    const jobStats = Object.fromEntries(indexingJobs.map((j) => [j.status, j._count.status]));
    const pendingJobs = (jobStats['PENDING'] ?? 0) + (jobStats['RUNNING'] ?? 0);
    const onlineAgents = agentsBrief.filter((a) => a.status === AgentStatus.ONLINE).length;

    const [recentJobs, recentQueries] = await Promise.all([
      this.prisma.indexingJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { document: { select: { externalId: true, storageId: true, name: true } } },
      }),
      this.prisma.queryLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { llmProvider: { select: { name: true } } },
      }),
    ]);

    const recentQueriesFlat = recentQueries.map((q) => ({
      id: q.id,
      query: q.query,
      answer: q.answer,
      llmProvider: q.llmProvider?.name ?? null,
      llmModel: q.llmModel,
      latencyMs: q.latencyMs,
      channel: q.channel,
      createdAt: q.createdAt,
    }));

    return {
      totalDocuments: documents,
      activeStorages,
      pendingJobs,
      onlineAgents,
      recentJobs,
      recentQueries: recentQueriesFlat,
      storages: storageTotal,
      jobStats,
      queriesToday: queriesTodayCount,
      agents: agentsBrief,
    };
  }

  async registerAgent(dto: RegisterAgentDto) {
    const secretHash = await hashBcrypt(dto.secret, 10);
    return this.prisma.agent.create({
      data: { name: dto.name, endpoint: dto.endpoint, secretHash, watchPath: dto.watchPath },
    });
  }

  async pingAgent(agentId: string) {
    const agent = await this.prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    const started = Date.now();
    try {
      await firstValueFrom(
        this.http.get(`${agent.endpoint}/health`, {
          headers: { 'x-agent-secret': this.cfg.get('AGENT_SECRET', 'dev-agent-secret') },
          timeout: 5000,
        }),
      );
      const latencyMs = Date.now() - started;
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: AgentStatus.ONLINE, lastHeartbeat: new Date() },
      });
      return { status: 'online' as const, latencyMs };
    } catch {
      await this.prisma.agent.update({ where: { id: agentId }, data: { status: AgentStatus.OFFLINE } });
      return { status: 'offline' as const, latencyMs: Date.now() - started };
    }
  }

  async getAgents() {
    return this.prisma.agent.findMany({
      select: {
        id: true,
        name: true,
        endpoint: true,
        status: true,
        watchPath: true,
        lastHeartbeat: true,
        createdAt: true,
      },
    });
  }

  async getQueryLogs(limit = 50) {
    return this.prisma.queryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true } }, llmProvider: { select: { name: true } } },
    });
  }
}
