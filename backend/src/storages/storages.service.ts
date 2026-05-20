import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageProvider } from '@prisma/client';
import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import * as crypto from 'crypto';

export class CreateStorageDto {
  @IsString() name: string;
  @IsEnum(StorageProvider) provider: StorageProvider;
  config: Record<string, any>; // raw credentials — encrypted before save
  @IsUUID() @IsOptional() agentId?: string;
}

@Injectable()
export class StoragesService {
  private readonly algo = 'aes-256-gcm';

  constructor(private readonly prisma: PrismaService) {}

  private encrypt(plaintext: string): string {
    const key = Buffer.from(process.env.APP_SECRET ?? 'dev-secret-32-chars-padded!!!!!!', 'utf8').slice(0, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algo, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('hex'), enc.toString('hex'), tag.toString('hex')].join('.');
  }

  private decrypt(ciphertext: string): string {
    try {
      const key = Buffer.from(process.env.APP_SECRET ?? 'dev-secret-32-chars-padded!!!!!!', 'utf8').slice(0, 32);
      const [ivHex, encHex, tagHex] = ciphertext.split('.');
      const iv = Buffer.from(ivHex, 'hex');
      const enc = Buffer.from(encHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algo, key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(enc) + decipher.final('utf8');
    } catch {
      return ciphertext; // dev mode: plain JSON fallback
    }
  }

  async findAll() {
    const rows = await this.prisma.storage.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            endpoint: true,
            status: true,
            lastHeartbeat: true,
            createdAt: true,
          },
        },
      },
    });

    return rows.map((s) => {
      let bucketOrPath = '—';
      let region: string | null = null;
      try {
        const cfg = JSON.parse(this.decrypt(s.configEnc));
        bucketOrPath =
          cfg.bucketOrPath ??
          cfg.bucket ??
          cfg.path ??
          cfg.watchPath ??
          bucketOrPath;
        region = cfg.region ?? cfg.awsRegion ?? null;
      } catch {
        /* keep defaults */
      }

      return {
        id: s.id,
        name: s.name,
        provider: s.provider,
        bucketOrPath,
        region,
        isActive: s.isActive,
        agentId: s.agentId,
        agent: s.agent,
        createdAt: s.createdAt,
      };
    });
  }

  async findById(id: string) {
    const s = await this.prisma.storage.findUnique({ where: { id }, include: { agent: true } });
    if (!s) throw new NotFoundException('Storage not found');
    return s;
  }

  async create(dto: CreateStorageDto) {
    const configEnc = this.encrypt(JSON.stringify(dto.config));
    return this.prisma.storage.create({
      data: { name: dto.name, provider: dto.provider, configEnc, agentId: dto.agentId ?? null },
      select: { id: true, name: true, provider: true, isActive: true, createdAt: true },
    });
  }

  async getDecryptedConfig(id: string): Promise<Record<string, any>> {
    const s = await this.findById(id);
    return JSON.parse(this.decrypt(s.configEnc));
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.storage.update({ where: { id }, data: { isActive } });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.storage.delete({ where: { id } });
  }
}
