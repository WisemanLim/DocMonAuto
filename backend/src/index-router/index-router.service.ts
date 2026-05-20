import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IndexingStrategy, SecurityLevel, Jurisdiction } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

export interface QueryPlan {
  documentIds: string[];
  strategy: IndexingStrategy;
  agentEndpoint: string;
  allowedLlms: string[];
}

export interface SearchResult {
  documentId: string;
  storageId: string;
  externalId: string;
  content: string;
  score: number;
  source: 'vector' | 'vectorless';
  metadata?: any;
}

@Injectable()
export class IndexRouterService {
  private readonly logger = new Logger(IndexRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
  ) {}

  // Build query plan: filter accessible documents by user permissions
  async buildQueryPlan(
    userSecurityLevel: SecurityLevel,
    userJurisdiction: Jurisdiction,
    userOrgUnit: string | null,
    strategy: IndexingStrategy,
    allowedLlms: string[],
  ): Promise<QueryPlan[]> {
    // Determine max security level user can access
    const levelOrder: SecurityLevel[] = [SecurityLevel.OPEN, SecurityLevel.INTERNAL, SecurityLevel.CONFIDENTIAL, SecurityLevel.SECRET];
    const maxIdx = levelOrder.indexOf(userSecurityLevel);
    const accessibleLevels = levelOrder.slice(0, maxIdx + 1);

    // Find ready documents within user's access scope
    const docs = await this.prisma.document.findMany({
      where: {
        isDeleted: false,
        securityLevel: { in: accessibleLevels },
        indexStatus: {
          OR: [{ vectorReady: true }, { vectorlessReady: true }],
        },
      },
      include: {
        storage: { include: { agent: true } },
        indexStatus: true,
      },
      take: 200,
    });

    // Group by agent endpoint
    const byAgent = new Map<string, typeof docs>();
    for (const doc of docs) {
      const ep: string =
        doc.storage.agent?.endpoint ??
        this.cfg.get<string>('AGENT_BASE_URL') ??
        'http://agent:8080';
      if (!byAgent.has(ep)) byAgent.set(ep, []);
      byAgent.get(ep)!.push(doc);
    }

    return Array.from(byAgent.entries()).map(([ep, agentDocs]) => ({
      documentIds: agentDocs.map((d) => d.id),
      strategy,
      agentEndpoint: ep,
      allowedLlms,
    }));
  }

  // Execute federated search across agents in parallel
  async search(query: string, plans: QueryPlan[]): Promise<SearchResult[]> {
    const agentSecret = this.cfg.get('AGENT_SECRET', 'dev-agent-secret');

    const searches = plans.map((plan) =>
      firstValueFrom(
        this.http.post<SearchResult[]>(
          `${plan.agentEndpoint}/search`,
          { query, documentIds: plan.documentIds, strategy: plan.strategy, topK: 5 },
          { headers: { 'x-agent-secret': agentSecret } },
        ),
      ).then((r) => r.data).catch((err) => {
        this.logger.warn(`Agent ${plan.agentEndpoint} search failed: ${err.message}`);
        return [] as SearchResult[];
      }),
    );

    const results = (await Promise.all(searches)).flat();

    // Reciprocal Rank Fusion (RRF) merge
    return this.rrfMerge(results);
  }

  private rrfMerge(results: SearchResult[], k = 60): SearchResult[] {
    const scores = new Map<string, number>();
    const byId = new Map<string, SearchResult>();

    // Sort by score desc, assign RRF rank
    const sorted = [...results].sort((a, b) => b.score - a.score);
    sorted.forEach((r, rank) => {
      const id = `${r.storageId}/${r.documentId}/${r.content.slice(0, 20)}`;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
      byId.set(id, r);
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({ ...byId.get(id)!, score }));
  }
}
