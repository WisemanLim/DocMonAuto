import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AgentStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
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
    const [storages, documents, indexingJobs, agents, queryLogs] = await Promise.all([
      this.prisma.storage.count(),
      this.prisma.document.count({ where: { isDeleted: false } }),
      this.prisma.indexingJob.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.agent.findMany({ select: { id: true, name: true, status: true, lastHeartbeat: true } }),
      this.prisma.queryLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    const jobStats = Object.fromEntries(indexingJobs.map((j) => [j.status, j._count.status]));

    return { storages, documents, jobStats, agents, queriesToday: queryLogs };
  }

  async registerAgent(dto: RegisterAgentDto) {
    const secretHash = await bcrypt.hash(dto.secret, 10);
    return this.prisma.agent.create({
      data: { name: dto.name, endpoint: dto.endpoint, secretHash, watchPath: dto.watchPath },
    });
  }

  async pingAgent(agentId: string) {
    const agent = await this.prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    try {
      await firstValueFrom(
        this.http.get(`${agent.endpoint}/health`, {
          headers: { 'x-agent-secret': this.cfg.get('AGENT_SECRET', 'dev-agent-secret') },
          timeout: 5000,
        }),
      );
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: AgentStatus.ONLINE, lastHeartbeat: new Date() },
      });
      return { status: 'online' };
    } catch {
      await this.prisma.agent.update({ where: { id: agentId }, data: { status: AgentStatus.OFFLINE } });
      return { status: 'offline' };
    }
  }

  async getAgents() {
    return this.prisma.agent.findMany({
      select: { id: true, name: true, endpoint: true, status: true, watchPath: true, lastHeartbeat: true },
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
