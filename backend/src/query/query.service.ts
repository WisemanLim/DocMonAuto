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
      return { answer: 'No accessible indexed documents found.', sources: [] };
    }

    // 3. Federated search across agents
    const searchResults = await this.router.search(dto.query, plans);

    if (!searchResults.length) {
      return { answer: 'No relevant documents found for your query.', sources: [] };
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

    await this.prisma.queryLog.create({
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
      latencyMs,
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
    return this.prisma.queryLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, query: true, answer: true, latencyMs: true, createdAt: true, llmModel: true },
    });
  }
}
