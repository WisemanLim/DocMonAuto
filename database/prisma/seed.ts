import { PrismaClient, UserRole, SecurityLevel, Jurisdiction, IndexingStrategy, StorageProvider, AgentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding DocMonAuto database...');

  // ── Add vector column to document_chunks (pgvector) ────────────
  await prisma.$executeRawUnsafe(`
    ALTER TABLE document_chunks
      ADD COLUMN IF NOT EXISTS embedding vector(1024);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
      ON document_chunks USING hnsw (embedding vector_cosine_ops);
  `);

  // ── Add tsvector column to document_page_index (FTS) ───────────
  await prisma.$executeRawUnsafe(`
    ALTER TABLE document_page_index
      ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_page_index_search
      ON document_page_index USING gin (search_vector);
  `);

  // ── Super admin user ────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin1234!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@docmonauto.local' },
    update: {},
    create: {
      email: 'admin@docmonauto.local',
      name: 'System Admin',
      password: adminPassword,
      role: UserRole.SUPER_ADMIN,
      orgUnit: 'IT',
      jurisdiction: Jurisdiction.GLOBAL,
    },
  });
  console.log(`  ✓ admin user: ${admin.email}`);

  // ── Demo viewer user ────────────────────────────────────────────
  const viewerPw = await bcrypt.hash('Viewer1234!', 10);
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@docmonauto.local' },
    update: {},
    create: {
      email: 'viewer@docmonauto.local',
      name: 'Demo Viewer',
      password: viewerPw,
      role: UserRole.VIEWER,
      orgUnit: 'General',
      jurisdiction: Jurisdiction.KR,
    },
  });
  console.log(`  ✓ viewer user: ${viewer.email}`);

  // ── Local dev agent ─────────────────────────────────────────────
  const agentSecret = process.env.AGENT_SECRET ?? 'dev-agent-secret';
  const agentHash = await bcrypt.hash(agentSecret, 10);
  const agent = await prisma.agent.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { secretHash: agentHash, status: AgentStatus.OFFLINE },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Local Dev Agent',
      endpoint: `http://agent:${process.env.AGENT_PORT ?? '8080'}`,
      secretHash: agentHash,
      status: AgentStatus.OFFLINE,
      watchPath: '/watch',
    },
  });
  console.log(`  ✓ agent: ${agent.name} → ${agent.endpoint}`);

  // ── Local on-premise storage (watches /watch directory) ─────────
  const localStorage = await prisma.storage.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Local Dev Storage',
      provider: StorageProvider.ON_PREMISE,
      configEnc: JSON.stringify({ watchPath: '/watch' }), // plain for dev
      isActive: true,
      agentId: agent.id,
    },
  });
  console.log(`  ✓ storage: ${localStorage.name}`);

  // ── Default policies ─────────────────────────────────────────────
  const policies = [
    {
      name: 'SECRET — on-premise only',
      description: 'SECRET 문서는 온프레 LLM + Vectorless 인덱싱만 허용',
      priority: 100,
      securityLevels: [SecurityLevel.SECRET],
      jurisdictions: [],
      orgUnits: [],
      strategy: IndexingStrategy.VECTORLESS_ONLY,
      allowedLlms: ['ollama'],
      indexingLocation: 'same_storage',
    },
    {
      name: 'CONFIDENTIAL — KR/on-premise LLM',
      description: 'CONFIDENTIAL 문서는 KR 클라우드 또는 온프레 LLM 사용',
      priority: 80,
      securityLevels: [SecurityLevel.CONFIDENTIAL],
      jurisdictions: [],
      orgUnits: [],
      strategy: IndexingStrategy.BOTH,
      allowedLlms: ['ollama', 'naver-cloud', 'kt-cloud'],
      indexingLocation: 'on-premise_or_kr',
    },
    {
      name: 'INTERNAL — all LLMs allowed',
      description: 'INTERNAL 이하 문서는 모든 LLM 사용 가능',
      priority: 50,
      securityLevels: [SecurityLevel.INTERNAL, SecurityLevel.OPEN],
      jurisdictions: [],
      orgUnits: [],
      strategy: IndexingStrategy.BOTH,
      allowedLlms: ['openai', 'google', 'aws-bedrock', 'ollama'],
      indexingLocation: 'any',
    },
  ];

  for (const p of policies) {
    await prisma.policy.upsert({
      where: { name: p.name } as any,
      update: {},
      create: p as any,
    });
    console.log(`  ✓ policy: ${p.name}`);
  }

  // ── LLM Providers ────────────────────────────────────────────────
  const providers = [
    {
      name: 'openai',
      displayName: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      isActive: false, // activated when API key is set
    },
    {
      name: 'google',
      displayName: 'Google Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: 'gemini-2.0-flash',
      isActive: false,
    },
    {
      name: 'aws-bedrock',
      displayName: 'AWS Bedrock',
      defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      isActive: false,
    },
    {
      name: 'ollama',
      displayName: 'Ollama (On-Premise)',
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      defaultModel: process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2',
      isActive: true, // default for dev
    },
  ];

  for (const p of providers) {
    await prisma.llmProvider.upsert({
      where: { name: p.name },
      update: { baseUrl: p.baseUrl, defaultModel: p.defaultModel },
      create: p,
    });
    console.log(`  ✓ llm provider: ${p.name}`);
  }

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
