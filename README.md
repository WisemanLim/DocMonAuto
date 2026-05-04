# DocMonAuto

**Document Monitoring & Automation Platform**  
비중앙화 멀티 스토리지 이벤트 기반 분산 RAG/LLM 플랫폼

---

## 개요

DocMonAuto는 AWS S3, GCP Storage, Azure Blob, 온프레미스 NFS 등 분산된 문서 스토리지를 **문서 원본 이동 없이** 모니터링하고, 스토리지 이벤트(생성/수정/삭제)를 트리거로 자동 RAG/LLM 인덱싱을 수행하는 플랫폼입니다.

## 아키텍처

```
[Storage Events]
  AWS S3 / GCP / Azure / 온프레미스
       │ (metadata only — no content transfer)
       ▼
[Python Agent]  ←→  [NestJS Backend]  ←→  [PostgreSQL + pgvector]
  watchdog            Policy Engine          document_chunks
  Docling             BullMQ Queue           document_page_index
  BGE-M3              Index Router
  pgvector            LLM Orchestrator
                           │
              [OpenAI / Google / Ollama]
                           │
         [Browser] [API] [MCP] [A2A]
```

## 디렉토리 구조

```
DocMonAuto/
├── .doc/          # PRD, Patent, 오픈소스 조사
├── ops/           # Docker Compose, DB 초기화
├── database/      # Prisma 스키마 & 마이그레이션
├── backend/       # NestJS API 서버
├── agent/         # Python FastAPI 스토리지 에이전트
├── frontend/      # Next.js 웹 (개발 예정)
└── .env.example   # 환경변수 템플릿
```

## 빠른 시작 (로컬 개발)

```bash
# 1. 환경변수
cp .env.example .env
# .env 편집: DATABASE_PASSWORD, JWT_SECRET, AGENT_SECRET 필수 변경

# 2. 감시 디렉토리 생성
mkdir -p /tmp/docmonauto-watch

# 3. 전체 스택 실행
cd ops && docker compose up -d

# 4. DB 마이그레이션 + 시드 (최초 1회)
cd ../database && npm install && npm run db:migrate && npm run db:seed
```

## 각 컴포넌트 문서

| 컴포넌트 | README |
|---------|--------|
| Ops (Docker) | [ops/README.md](ops/README.md) |
| Database | [database/README.md](database/README.md) |
| Backend (NestJS) | [backend/README.md](backend/README.md) |
| Agent (Python) | [agent/README.md](agent/README.md) |

## 기술 스택

| 레이어 | 기술 | 라이선스 |
|-------|-----|---------|
| Backend | NestJS 10 + Fastify | MIT |
| Agent | Python 3.12 + FastAPI | MIT |
| Database | PostgreSQL 16 + pgvector | MIT / PostgreSQL |
| Queue | BullMQ + Valkey | MIT / BSD-3 |
| Embedding | BGE-M3 (sentence-transformers) | MIT |
| Document Parse | Docling (IBM) | MIT |
| LLM | OpenAI / Google / Ollama | 상용 / MIT |

## 주요 API 엔드포인트

| Method | Path | 설명 |
|--------|------|-----|
| POST | `/api/v1/auth/login` | JWT 로그인 |
| POST | `/api/v1/query` | RAG 질의응답 |
| GET | `/api/v1/query/history` | 질의 이력 |
| POST | `/api/v1/internal/events/storage` | 에이전트 이벤트 수신 |
| GET | `/api/v1/admin/dashboard` | 관리자 대시보드 |
| GET | `/health` | 헬스체크 |
| GET | `/api/docs` | Swagger UI |
