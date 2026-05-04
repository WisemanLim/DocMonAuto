import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventType, SecurityLevel, IndexingStrategy, JobStatus } from '@prisma/client';
import { INDEXING_QUEUE } from './indexing.module';

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    @InjectQueue(INDEXING_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(
    documentId: string,
    eventType: EventType,
    securityLevel: SecurityLevel,
    priorityScore: number,
    strategy: IndexingStrategy = IndexingStrategy.BOTH,
  ) {
    // BullMQ priority: lower number = higher priority (invert score)
    const bullPriority = Math.round((1 - priorityScore) * 100);

    // Persist job record
    const job = await this.prisma.indexingJob.create({
      data: { documentId, eventType, strategy, priorityScore, status: JobStatus.PENDING },
    });

    // Select processing tier based on score
    const delay = priorityScore >= 0.7 ? 0
      : priorityScore >= 0.3 ? 0          // near-realtime; BullMQ handles ordering
      : 5 * 60 * 1000;                     // batch tier: 5 min delay

    const bullJob = await this.queue.add(
      'index',
      { jobId: job.id, documentId, eventType, strategy },
      { priority: bullPriority, delay, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    await this.prisma.indexingJob.update({
      where: { id: job.id },
      data: { bullJobId: String(bullJob.id) },
    });

    this.logger.log(`Enqueued job ${job.id} (priority=${priorityScore.toFixed(2)}, tier=${delay === 0 ? 'realtime' : 'batch'})`);
    return job;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  async getRecentJobs(limit = 20) {
    return this.prisma.indexingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { document: { select: { name: true, storageId: true } } },
    });
  }
}
