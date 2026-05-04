import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus, EventType } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { INDEXING_QUEUE } from './indexing.module';

interface IndexJobData {
  jobId: string;
  documentId: string;
  eventType: EventType;
  strategy: string;
}

@Processor(INDEXING_QUEUE)
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
  ) {}

  @Process('index')
  async handle(job: Job<IndexJobData>) {
    const { jobId, documentId, eventType, strategy } = job.data;
    this.logger.log(`Processing job ${jobId} — ${eventType} doc=${documentId}`);

    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: JobStatus.RUNNING, startedAt: new Date(), attempts: job.attemptsMade + 1 },
    });

    try {
      // Load document + storage info
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: { storage: { include: { agent: true } } },
      });

      if (!document) throw new Error(`Document ${documentId} not found`);

      const agentEndpoint = document.storage.agent?.endpoint ?? this.cfg.get('AGENT_BASE_URL', 'http://agent:8080');
      const agentSecret = this.cfg.get('AGENT_SECRET', 'dev-agent-secret');

      const payload = {
        documentId: document.id,
        externalId: document.externalId,
        storageId: document.storageId,
        eventType,
        strategy,
        securityLevel: document.securityLevel,
        contentType: document.contentType,
        metadata: document.metadata,
      };

      if (eventType === EventType.DELETE) {
        await firstValueFrom(
          this.http.post(`${agentEndpoint}/index/delete`, payload, {
            headers: { 'x-agent-secret': agentSecret },
          }),
        );
      } else {
        await firstValueFrom(
          this.http.post(`${agentEndpoint}/index`, payload, {
            headers: { 'x-agent-secret': agentSecret },
          }),
        );
      }

      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: JobStatus.COMPLETED, completedAt: new Date() },
      });

      this.logger.log(`Job ${jobId} completed`);
    } catch (err: any) {
      this.logger.error(`Job ${jobId} failed: ${err.message}`);
      const isFinal = job.attemptsMade + 1 >= job.opts.attempts!;
      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: isFinal ? JobStatus.FAILED : JobStatus.PENDING,
          errorMsg: err.message,
        },
      });
      throw err; // BullMQ retries
    }
  }
}
