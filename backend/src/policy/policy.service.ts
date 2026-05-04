import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLevel, Jurisdiction, IndexingStrategy } from '@prisma/client';

export interface PolicyContext {
  securityLevel: SecurityLevel;
  jurisdiction: Jurisdiction;
  orgUnit?: string | null;
}

export interface PolicyDecision {
  strategy: IndexingStrategy;
  allowedLlms: string[];
  indexingLocation: string;
}

const DEFAULT_DECISION: PolicyDecision = {
  strategy: IndexingStrategy.BOTH,
  allowedLlms: ['openai', 'google', 'aws-bedrock', 'ollama'],
  indexingLocation: 'any',
};

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(ctx: PolicyContext): Promise<PolicyDecision> {
    // Load active policies ordered by priority desc
    const policies = await this.prisma.policy.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const policy of policies) {
      if (!this.matches(policy, ctx)) continue;

      return {
        strategy: policy.strategy,
        allowedLlms: policy.allowedLlms,
        indexingLocation: policy.indexingLocation,
      };
    }

    return DEFAULT_DECISION;
  }

  private matches(policy: any, ctx: PolicyContext): boolean {
    const secMatch =
      !policy.securityLevels?.length || policy.securityLevels.includes(ctx.securityLevel);
    const jurMatch =
      !policy.jurisdictions?.length || policy.jurisdictions.includes(ctx.jurisdiction);
    const orgMatch =
      !policy.orgUnits?.length || (ctx.orgUnit && policy.orgUnits.includes(ctx.orgUnit));
    return secMatch && jurMatch && orgMatch;
  }

  async findAll() {
    return this.prisma.policy.findMany({ orderBy: { priority: 'desc' } });
  }

  async create(data: any) {
    return this.prisma.policy.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.policy.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.policy.delete({ where: { id } });
  }
}
