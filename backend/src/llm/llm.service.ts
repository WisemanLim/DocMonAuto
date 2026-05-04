import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLevel } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import OpenAI from 'openai';

export interface LlmRequest {
  query: string;
  context: string;         // retrieved chunks joined
  allowedLlms: string[];
  securityLevel: SecurityLevel;
  channel: string;
  stream?: boolean;
}

export interface LlmResponse {
  answer: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
}

const SECURITY_PREFERRED: Record<SecurityLevel, string[]> = {
  SECRET:       ['ollama'],
  CONFIDENTIAL: ['ollama', 'naver-cloud', 'kt-cloud'],
  INTERNAL:     ['openai', 'ollama', 'google'],
  OPEN:         ['openai', 'google', 'aws-bedrock', 'ollama'],
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const provider = this.selectProvider(req.allowedLlms, req.securityLevel);
    this.logger.log(`LLM: ${provider} | channel=${req.channel} | level=${req.securityLevel}`);

    const systemPrompt = this.buildSystemPrompt(req.channel);
    const userPrompt = this.buildUserPrompt(req.query, req.context);

    switch (provider) {
      case 'openai':
        return this.callOpenAI(systemPrompt, userPrompt);
      case 'ollama':
        return this.callOllama(systemPrompt, userPrompt);
      case 'google':
        return this.callGoogle(systemPrompt, userPrompt);
      default:
        return this.callOllama(systemPrompt, userPrompt); // fallback
    }
  }

  private selectProvider(allowed: string[], secLevel: SecurityLevel): string {
    const preferred = SECURITY_PREFERRED[secLevel] ?? ['ollama'];
    for (const p of preferred) {
      if (allowed.includes(p)) return p;
    }
    if (allowed.length) return allowed[0];
    throw new BadRequestException('No LLM provider available for this security context');
  }

  private buildSystemPrompt(channel: string): string {
    const baseInstructions = `You are DocMonAuto, an AI assistant for enterprise document Q&A.
Answer ONLY based on the provided context. If the context doesn't contain enough information, say so clearly.
Always cite source documents when possible.`;

    const channelInstructions: Record<string, string> = {
      browser: `${baseInstructions}\nFormat your response in Markdown with clear headings and bullet points.`,
      mcp:     `${baseInstructions}\nRespond with concise, structured text suitable for programmatic use.`,
      a2a:     `${baseInstructions}\nRespond in JSON format: {"answer": "...", "sources": [...]}`,
      api:     `${baseInstructions}\nRespond concisely and accurately.`,
    };

    return channelInstructions[channel] ?? baseInstructions;
  }

  private buildUserPrompt(query: string, context: string): string {
    return `Context:\n${context}\n\nQuestion: ${query}`;
  }

  private async callOpenAI(system: string, user: string): Promise<LlmResponse> {
    const apiKey = this.cfg.get<string>('OPENAI_API_KEY', '');
    const model = this.cfg.get<string>('OPENAI_DEFAULT_MODEL', 'gpt-4o-mini');
    const client = new OpenAI({ apiKey });

    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.2,
    });

    return {
      answer: res.choices[0]?.message?.content ?? '',
      provider: 'openai',
      model,
      tokensInput: res.usage?.prompt_tokens ?? 0,
      tokensOutput: res.usage?.completion_tokens ?? 0,
    };
  }

  private async callOllama(system: string, user: string): Promise<LlmResponse> {
    const baseUrl = this.cfg.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    const model = this.cfg.get<string>('OLLAMA_DEFAULT_MODEL', 'llama3.2');

    const res = await firstValueFrom(
      this.http.post(`${baseUrl}/api/chat`, {
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        stream: false,
        options: { temperature: 0.2 },
      }),
    );

    const data = res.data;
    return {
      answer: data.message?.content ?? '',
      provider: 'ollama',
      model,
      tokensInput: data.prompt_eval_count ?? 0,
      tokensOutput: data.eval_count ?? 0,
    };
  }

  private async callGoogle(system: string, user: string): Promise<LlmResponse> {
    const apiKey = this.cfg.get<string>('GOOGLE_AI_API_KEY', '');
    const model = this.cfg.get<string>('GOOGLE_AI_DEFAULT_MODEL', 'gemini-2.0-flash');

    const res = await firstValueFrom(
      this.http.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { temperature: 0.2 },
        },
      ),
    );

    const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const usage = res.data?.usageMetadata ?? {};
    return {
      answer,
      provider: 'google',
      model,
      tokensInput: usage.promptTokenCount ?? 0,
      tokensOutput: usage.candidatesTokenCount ?? 0,
    };
  }

  async getActiveProviders() {
    return this.prisma.llmProvider.findMany({ where: { isActive: true } });
  }
}
