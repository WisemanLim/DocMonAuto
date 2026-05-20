import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from '../policy/policy.service';
import { IndexRouterService } from '../index-router/index-router.service';
import { LlmService } from '../llm/llm.service';
import { SecurityLevel, Jurisdiction, QueryChannel } from '@prisma/client';
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class QueryDto {
  @IsString() query: string;
  @IsEnum(QueryChannel) @IsOptional() channel?: QueryChannel;
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly router: IndexRouterService,
    private readonly llm: LlmService,
  ) {}

  async answer(
    dto: QueryDto,
    user: { id: string; role: string; jurisdiction: Jurisdiction; orgUnit: string | null },
  ) {
    const channel = dto.channel ?? QueryChannel.API;
    const start = Date.now();

    // 1. Evaluate policy for this user context
    const userSecLevel = this.roleToSecLevel(user.role);
    const policyDecision = await this.policy.evaluate({
      securityLevel: userSecLevel,
      jurisdiction: user.jurisdiction,
      orgUnit: user.orgUnit,
    });

    // 2. Build query plans (federated routing)
    const plans = await this.router.buildQueryPlan(
      userSecLevel,
      user.jurisdiction,
      user.orgUnit,
      policyDecision.strategy,
      policyDecision.allowedLlms,
    );

    if (!plans.length) {
      const latencyMs = Date.now() - start;
      return {
        answer: '인덱싱된 문서가 없거나 접근 가능한 스토리지가 없습니다.',
        sources: [],
        latencyMs,
        logId: null as string | null,
        llmProvider: null as string | null,
        llmModel: null as string | null,
        provider: null as string | null,
        model: null as string | null,
      };
    }

    const searchResults = await this.router.search(dto.query, plans);

    if (!searchResults.length) {
      const latencyMs = Date.now() - start;
      return {
        answer: '관련 문서를 찾지 못했습니다.',
        sources: [],
        latencyMs,
        logId: null as string | null,
        llmProvider: null as string | null,
        llmModel: null as string | null,
        provider: null as string | null,
        model: null as string | null,
      };
    }

    // 4. Build context from top results
    const context = searchResults
      .slice(0, 5)
      .map((r, i) => `[${i + 1}] ${r.content}`)
      .join('\n\n');

    // 5. LLM generation
    const llmRes = await this.llm.complete({
      query: dto.query,
      context,
      allowedLlms: policyDecision.allowedLlms,
      securityLevel: userSecLevel,
      channel: channel.toLowerCase(),
    });

    const latencyMs = Date.now() - start;

    // 6. Persist query log
    const providerRecord = await this.prisma.llmProvider.findUnique({
      where: { name: llmRes.provider },
    });

    const log = await this.prisma.queryLog.create({
      data: {
        userId: user.id,
        channel,
        query: dto.query,
        answer: llmRes.answer,
        llmProviderId: providerRecord?.id,
        llmModel: llmRes.model,
        strategy: policyDecision.strategy,
        documentsUsed: searchResults.slice(0, 5).map((r) => ({
          documentId: r.documentId,
          storageId: r.storageId,
          score: r.score,
          source: r.source,
        })),
        latencyMs,
        tokensInput: llmRes.tokensInput,
        tokensOutput: llmRes.tokensOutput,
      },
    });

    return {
      answer: llmRes.answer,
      provider: llmRes.provider,
      model: llmRes.model,
      llmProvider: llmRes.provider,
      llmModel: llmRes.model,
      latencyMs,
      logId: log.id,
      sources: searchResults.slice(0, 5).map((r) => ({
        documentId: r.documentId,
        storageId: r.storageId,
        score: r.score,
        source: r.source,
        excerpt: r.content.slice(0, 200),
      })),
    };
  }

  private roleToSecLevel(role: string): SecurityLevel {
    const map: Record<string, SecurityLevel> = {
      SUPER_ADMIN: SecurityLevel.SECRET,
      ADMIN:       SecurityLevel.CONFIDENTIAL,
      EDITOR:      SecurityLevel.INTERNAL,
      VIEWER:      SecurityLevel.OPEN,
    };
    return map[role] ?? SecurityLevel.OPEN;
  }

  async getHistory(userId: string, limit = 20) {
    const rows = await this.prisma.queryLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { llmProvider: { select: { name: true } } },
    });
    return rows.map((q) => ({
      id: q.id,
      query: q.query,
      answer: q.answer,
      llmProvider: q.llmProvider?.name ?? null,
      llmModel: q.llmModel,
      latencyMs: q.latencyMs,
      channel: q.channel,
      createdAt: q.createdAt,
    }));
  }
}
