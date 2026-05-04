import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from '../policy/policy.service';
import { IndexingService } from '../indexing/indexing.service';
import { EventType, SecurityLevel, Jurisdiction } from '@prisma/client';

export interface StorageEventDto {
  eventType: EventType;
  storageId: string;
  externalId: string;      // object key / file path
  name: string;
  contentType?: string;
  sizeBytes?: number;
  securityLevel?: SecurityLevel;
  orgUnit?: string;
  jurisdiction?: Jurisdiction;
  tags?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly indexing: IndexingService,
  ) {}

  async handleStorageEvent(dto: StorageEventDto) {
    this.logger.log(`Event received: ${dto.eventType} ${dto.storageId}/${dto.externalId}`);

    // Upsert document metadata (no content — metadata registry only)
    let document = await this.prisma.document.findUnique({
      where: { storageId_externalId: { storageId: dto.storageId, externalId: dto.externalId } },
    });

    if (dto.eventType === EventType.DELETE) {
      if (document) {
        await this.prisma.document.update({ where: { id: document.id }, data: { isDeleted: true } });
        await this.indexing.enqueue(document.id, EventType.DELETE, document.securityLevel, 0.9);
      }
      return { status: 'queued', eventType: 'DELETE' };
    }

    // CREATE or UPDATE — upsert document record
    document = await this.prisma.document.upsert({
      where: { storageId_externalId: { storageId: dto.storageId, externalId: dto.externalId } },
      update: {
        name: dto.name,
        contentType: dto.contentType ?? 'application/octet-stream',
        sizeBytes: BigInt(dto.sizeBytes ?? 0),
        securityLevel: dto.securityLevel ?? SecurityLevel.INTERNAL,
        orgUnit: dto.orgUnit,
        jurisdiction: dto.jurisdiction ?? Jurisdiction.GLOBAL,
        tags: dto.tags ?? [],
        metadata: dto.metadata,
        isDeleted: false,
        updatedAt: new Date(),
      },
      create: {
        storageId: dto.storageId,
        externalId: dto.externalId,
        name: dto.name,
        contentType: dto.contentType ?? 'application/octet-stream',
        sizeBytes: BigInt(dto.sizeBytes ?? 0),
        securityLevel: dto.securityLevel ?? SecurityLevel.INTERNAL,
        orgUnit: dto.orgUnit,
        jurisdiction: dto.jurisdiction ?? Jurisdiction.GLOBAL,
        tags: dto.tags ?? [],
        metadata: dto.metadata,
      },
    });

    // Evaluate policy → indexing strategy
    const policyDecision = await this.policy.evaluate({
      securityLevel: document.securityLevel,
      jurisdiction: document.jurisdiction,
      orgUnit: document.orgUnit,
    });

    // Compute priority score
    const priorityScore = await this.computePriority(document.id, document.securityLevel, dto.sizeBytes ?? 0);

    // Enqueue indexing job
    await this.indexing.enqueue(document.id, dto.eventType, document.securityLevel, priorityScore, policyDecision.strategy);

    return { status: 'queued', documentId: document.id, strategy: policyDecision.strategy, priorityScore };
  }

  private async computePriority(documentId: string, securityLevel: SecurityLevel, sizeBytes: number): Promise<number> {
    const secWeight: Record<SecurityLevel, number> = {
      SECRET: 1.0, CONFIDENTIAL: 0.8, INTERNAL: 0.5, OPEN: 0.3,
    };

    // Query frequency in last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const qfRaw = await this.prisma.queryLog.count({
      where: { createdAt: { gte: since }, documentsUsed: { path: '$[*].documentId', equals: documentId } },
    });
    const queryFreq = Math.min(qfRaw / 100, 1.0); // normalize 0..1

    const recency = 1.0; // brand new event — always max recency
    const sizeInv = sizeBytes > 0 ? Math.min(1_000_000 / sizeBytes, 1.0) : 1.0;

    return (
      0.4 * queryFreq +
      0.3 * (secWeight[securityLevel] ?? 0.5) +
      0.2 * recency +
      0.1 * sizeInv
    );
  }
}
