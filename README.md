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
├── .test/         # 환경 시험 시나리오·검증 결과(md) — 로컬 단독 vs Docker Compose
├── ops/           # Docker Compose, DB 초기화
├── database/      # Prisma 스키마 & 마이그레이션
├── backend/       # NestJS API 서버
├── agent/         # Python FastAPI 스토리지 에이전트
├── frontend/      # Next.js 웹 앱
├── test/          # API 시험 셸 스크립트(선택)
└── .env.example   # 환경변수 템플릿(상단에 로컬/Docker 이원 실행 안내)
```

## 빠른 시작

### A. Docker Compose로 전체 실행 (권장: 일관된 검증)

```bash
cp .env.example .env
# DATABASE_PASSWORD, JWT_SECRET, AGENT_SECRET 등 필수 변경

mkdir -p /tmp/docmonauto-watch

cd ops && ln -sf ../.env .env && ./up -d

cd ../database && npm install && npm run db:migrate && npm run db:seed
```

- UI: `http://localhost:3000` — `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001` 권장(브라우저→백엔드).
- Compose는 각 서비스에 `DATABASE_URL`·`AGENT_BASE_URL`·`BACKEND_URL` 등을 **파일에서 재정의**하므로, 루트 `.env`를 “로컬 호스트용”으로 두어도 컨테이너 동작과 충돌하지 않습니다. 자세한 표는 [`.test/scenario-docker-compose.md`](.test/scenario-docker-compose.md).

### B. 컴포넌트 디렉터리에서 직접 실행

PostgreSQL·Valkey를 호스트 또는 `docker compose up postgres valkey`로 둔 뒤:

| 컴포넌트 | 예시 |
|----------|------|
| agent | `cd agent && uvicorn main:app --host 0.0.0.0 --port 8080 --reload` |
| backend | `cd backend && npm run start:dev` |
| frontend | `cd frontend && npm run dev` |

루트 `.env`에서는 로컬 호출에 맞게 `AGENT_BASE_URL=http://localhost:8080` 등을 쓰면 됩니다. 절차 전체: [`.test/scenario-local-components.md`](.test/scenario-local-components.md).

## 환경 시험 기록

검증 시나리오·결과 양식은 [`.test/`](.test/) 디렉터리의 Markdown을 사용합니다. API 자동 시험 스크립트는 [`test/`](test/)를 참고합니다.

## 각 컴포넌트 문서

| 컴포넌트 | README |
|---------|--------|
| Ops (Docker) | [ops/README.md](ops/README.md) |
| Database | [database/README.md](database/README.md) |
| Backend (NestJS) | [backend/README.md](backend/README.md) |
| Frontend (Next.js) | [frontend/README.md](frontend/README.md) |
| Agent (Python) | [agent/README.md](agent/README.md) |
| 환경 시험 (시나리오·결과) | [`.test/README.md`](.test/README.md) |

## 기술 스택

| 레이어 | 기술 | 라이선스 |
|-------|-----|---------|
| Backend | NestJS 10 + Fastify | MIT |
| Frontend | Next.js 15 | MIT |
| Agent | Python 3.12 + FastAPI | MIT |
| Database | PostgreSQL 16 + pgvector | MIT / PostgreSQL |
| Queue | BullMQ + Valkey | MIT / BSD-3 |
| Embedding | BGE-M3 (sentence-transformers) | MIT |
| Document Parse | Docling (IBM) | MIT |
| LLM | OpenAI / Google / Ollama | 상용 / MIT |

## 주요 API 엔드포인트

| Method | Path | 설명 |
|--------|------|-----|
| POST | `/v1/auth/login` | JWT 로그인 |
| POST | `/v1/query` | RAG 질의응답 |
| GET | `/v1/query/history` | 질의 이력 |
| POST | `/v1/internal/events/storage` | 에이전트 이벤트 수신 |
| GET | `/v1/admin/dashboard` | 관리자 대시보드 |
| GET | `/v1/health` | 헬스체크 |
| GET | `/api/docs` | Swagger UI |
