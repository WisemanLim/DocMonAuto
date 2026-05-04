# Product Requirements Document (PRD)

**프로젝트명**: DocMonAuto  
**풀네임**: Document Monitoring & Automation Platform  
**버전**: v0.1.0  
**작성일**: 2026-04-30  
**상태**: 검토 중 (Review)

---

## 1. 프로젝트 개요

### 1.1 제품 설명

DocMonAuto는 클라우드(AWS, GCP, Azure, Naver Cloud, KT Cloud) 및 온프레미스 환경에 분산된 문서 스토리지를 **문서 원본 이동 없이** 모니터링하고, 스토리지 이벤트(생성/수정/삭제)를 트리거로 자동으로 RAG/LLM 인덱싱을 수행하는 비중앙화 분산 문서 인텔리전스 플랫폼이다.

### 1.2 핵심 가치 제안

| 가치 | 설명 |
|-----|-----|
| 비중앙화 | 문서 원본을 이동하지 않고 각 스토리지 위치에서 인덱싱 |
| 이벤트 자동화 | 문서 변경 즉시 자동 인덱스 갱신 |
| 정책 기반 보안 | 보안 등급·규제·관할권에 따른 인덱싱·LLM 자동 결정 |
| 멀티 LLM | 상용(OpenAI, Google, AWS Bedrock)·오픈소스(Llama, Mistral) 통합 |
| 멀티 채널 질의 | Browser, Desktop App, MCP, A2A, API 통합 지원 |

### 1.3 대상 사용자

- **기업 IT 관리자**: 분산된 조직 문서의 RAG 서비스 구축/운영
- **보안 담당자**: 문서 접근 정책 및 데이터 주권 관리
- **업무 사용자**: 사내 문서 기반 AI 질의응답 활용
- **개발자/에이전트**: MCP/API/A2A를 통한 프로그래백 접근

---

## 2. 시스템 아키텍처

### 2.1 전체 구성

```
┌────────────────────────────────────────────────┐
│              사용자 인터페이스 계층               │
│  [Web Browser] [Desktop App] [MCP] [A2A] [API] │
└───────────────────────┬────────────────────────┘
                        │
┌───────────────────────▼────────────────────────┐
│              Backend (NestJS)                   │
│  API Gateway / Auth / 질의 분석 / LLM 오케스트레이터 │
│  정책 엔진 / 글로벌 인덱스 라우터 / 이벤트 허브    │
└──────────┬───────────────────────┬─────────────┘
           │                       │
┌──────────▼──────┐    ┌───────────▼─────────────┐
│   Database       │    │   스토리지 에이전트         │
│   PostgreSQL     │    │   (각 스토리지 위치 배포)   │
│   + pgvector     │    │   AWS/GCP/Azure/온프레    │
└─────────────────┘    └─────────────────────────┘
```

### 2.2 소프트웨어 스택

| 레이어 | 기술 | 버전 목표 |
|-------|-----|---------|
| Frontend | Next.js (App Router) | 15.x |
| Backend | NestJS | 10.x |
| Database | PostgreSQL + pgvector | 16.x |
| 스토리지 에이전트 | Python (FastAPI) | 3.12 |
| 벡터 임베딩 | BGE-M3 / text-embedding-3 | — |
| 컨테이너 | Docker + Docker Compose | — |
| 메시지 큐 | Redis Streams (또는 BullMQ) | — |

### 2.3 디렉토리 구조

```
DocMonAuto/
├── .doc/                  # 프로젝트 문서 (PRD, Patent 등)
├── frontend/              # Next.js 웹 애플리케이션
├── backend/               # NestJS API 서버 + 핵심 엔진
├── database/              # DB 스키마, 마이그레이션
├── ops/                   # Docker Compose, 배포, 헬스체크
└── .env.example           # 환경변수 템플릿
```

---

## 3. 기능 요구사항

### 3.1 스토리지 커넥터 & 이벤트 수집

**우선순위**: P0 (MVP 필수)

| 기능 ID | 기능명 | 설명 |
|--------|-------|-----|
| SC-01 | AWS S3 커넥터 | S3 Event Notification → SQS/SNS → 에이전트 |
| SC-02 | GCP Storage 커넥터 | GCS Object Notifications / Pub/Sub |
| SC-03 | Azure Blob 커넥터 | Azure Event Grid 연동 |
| SC-04 | 온프레미스 커넥터 | inotify / FSEvents 기반 FileSystem Watcher |
| SC-05 | Naver/KT Cloud 커넥터 | Object Storage 이벤트 (P1, MVP 이후) |
| SC-06 | 이벤트 정규화 | 스토리지별 이벤트를 통합 포맷으로 변환 |
| SC-07 | 이벤트 메타데이터 추출 | 문서 유형, 크기, 보안 태그, 조직, 관할권 |

이벤트 표준 포맷:
```json
{
  "event_id": "uuid",
  "event_type": "CREATE | UPDATE | DELETE",
  "storage_provider": "aws-s3 | gcp-storage | azure-blob | on-premise",
  "storage_id": "bucket-or-share-name",
  "document_id": "path/to/document.pdf",
  "metadata": {
    "size_bytes": 1048576,
    "content_type": "application/pdf",
    "security_level": "OPEN | INTERNAL | CONFIDENTIAL | SECRET",
    "org_unit": "string",
    "jurisdiction": "KR | EU | US | GLOBAL",
    "tags": ["string"]
  },
  "timestamp": "ISO8601"
}
```

### 3.2 정책 엔진

**우선순위**: P0 (MVP 필수)

| 기능 ID | 기능명 | 설명 |
|--------|-------|-----|
| PE-01 | 보안 등급 기반 정책 | SECRET/CONFIDENTIAL/INTERNAL/OPEN별 규칙 |
| PE-02 | 관할권 기반 정책 | KR/EU/US/GLOBAL별 허용 스토리지·LLM 제한 |
| PE-03 | 인덱싱 방식 결정 | Vector / Vectorless / 이중 인덱싱 선택 |
| PE-04 | LLM 허용 목록 결정 | 보안 맥락별 사용 가능 LLM 목록 반환 |
| PE-05 | 정책 규칙 관리 UI | 관리자가 정책 규칙 CRUD |
| PE-06 | 정책 감사 로그 | 정책 결정 이력 기록 |

기본 정책 규칙 예시:
```yaml
- condition: security_level == "SECRET"
  indexing: vectorless_only
  llm_allowed: ["on-premise"]
  indexing_location: same_storage

- condition: security_level == "CONFIDENTIAL" AND jurisdiction == "KR"
  indexing: vector_and_vectorless
  llm_allowed: ["on-premise", "naver-cloud", "kt-cloud"]
  indexing_location: on-premise_or_kr

- condition: security_level IN ["OPEN", "INTERNAL"]
  indexing: vector_and_vectorless
  llm_allowed: ["openai", "google", "aws-bedrock", "on-premise"]
  indexing_location: any
```

### 3.3 인덱싱 파이프라인

**우선순위**: P0 (MVP 필수)

| 기능 ID | 기능명 | 설명 |
|--------|-------|-----|
| IN-01 | 우선순위 큐 | Priority_Score 기반 인덱싱 작업 순서화 |
| IN-02 | Vectorless 인덱서 | 페이지/섹션 단위 구조 인덱스 빠르게 생성 |
| IN-03 | Vector 인덱서 | 임베딩 모델로 청킹 + 벡터화 + pgvector 저장 |
| IN-04 | 증분 인덱싱 | UPDATE 이벤트 시 변경 부분만 재인덱싱 |
| IN-05 | 인덱스 폐기 | DELETE 이벤트 시 해당 인덱스 전체 제거 |
| IN-06 | 인덱싱 상태 추적 | pending / running / ready / failed 상태 관리 |
| IN-07 | 재시도 로직 | 실패 시 지수 백오프 재시도 |
| IN-08 | 멀티 임베딩 모델 | BGE-M3 (기본), text-embedding-3, 온프레 모델 |

우선순위 스코어링:
```
Priority_Score = 
  0.4 × normalize(query_frequency_30d) +
  0.3 × security_weight +          # SECRET=1.0, CONFIDENTIAL=0.8, INTERNAL=0.5, OPEN=0.3
  0.2 × recency_weight +           # 이벤트 발생 후 경과 시간의 역수
  0.1 × size_inverse_weight        # 소형 문서 우선 (빠른 서비스 반영)

처리 경로:
  Score ≥ 0.7 → 즉시 동기 인덱싱
  0.3 ≤ Score < 0.7 → 준실시간 큐 (목표 5분 이내)
  Score < 0.3 → 배치 스케줄 (1시간 주기)
```

### 3.4 글로벌 인덱스 라우터

**우선순위**: P0 (MVP 필수)

| 기능 ID | 기능명 | 설명 |
|--------|-------|-----|
| IR-01 | 라우팅 테이블 관리 | 문서별 인덱스 위치, 상태, 정책 관리 |
| IR-02 | 권한 교차검증 | 사용자 권한 × 문서 정책 필터링 |
| IR-03 | 쿼리 플랜 생성 | 접근 가능 인덱스 선별, Vector/Vectorless 우선순위 결정 |
| IR-04 | 분산 병렬 질의 | 복수 에이전트에 병렬 검색 요청 |
| IR-05 | 결과 통합 순위화 | Federated Ranking (RRF 또는 유사도 앙상블) |
| IR-06 | 인덱스 헬스 체크 | 에이전트별 인덱스 가용성 주기적 확인 |

### 3.5 멀티 LLM 오케스트레이터

**우선순위**: P0 (MVP 필수)

| 기능 ID | 기능명 | 설명 |
|--------|-------|-----|
| LO-01 | LLM 어댑터 — OpenAI | GPT-4o, GPT-4o-mini |
| LO-02 | LLM 어댑터 — Google | Gemini 2.0 Flash, Gemini 1.5 Pro |
| LO-03 | LLM 어댑터 — AWS Bedrock | Claude 3.5 Sonnet, Nova 등 |
| LO-04 | LLM 어댑터 — 온프레미스 | Ollama API 호환 (Llama, Mistral, Qwen 등) |
| LO-05 | LLM 선택 엔진 | 보안 맥락·채널·질의유형 기반 동적 선택 |
| LO-06 | 프롬프트 빌더 | 채널별 형식 + 인용 출처 포함 프롬프트 구성 |
| LO-07 | 응답 형식 변환 | Browser(MD) / MCP(JSON) / A2A(protocol) / API(JSON) |
| LO-08 | 스트리밍 응답 | SSE 기반 스트리밍 (Browser, Desktop) |

### 3.6 질의 채널

**우선순위**: P0 Browser, P1 나머지

| 기능 ID | 채널 | 설명 |
|--------|-----|-----|
| QC-01 | Web Browser | Next.js 기반 챗 인터페이스, 문서 인용 표시 |
| QC-02 | REST API | 외부 시스템 연동용 표준 REST API |
| QC-03 | MCP Server | Model Context Protocol 도구 제공 |
| QC-04 | A2A | Agent-to-Agent 프로토콜 엔드포인트 |
| QC-05 | Desktop App | Electron 또는 Tauri 기반 (P2) |

### 3.7 관리자 기능

**우선순위**: P0 (MVP 필수)

| 기능 ID | 기능명 | 설명 |
|--------|-------|-----|
| AD-01 | 스토리지 커넥터 관리 | 커넥터 등록, 자격증명 관리, 연결 상태 확인 |
| AD-02 | 인덱싱 모니터링 | 인덱싱 작업 현황, 큐 상태, 오류 현황 대시보드 |
| AD-03 | 정책 관리 | 보안 등급별 정책 규칙 CRUD |
| AD-04 | LLM 설정 | LLM 제공자별 API 키, 엔드포인트 설정 |
| AD-05 | 사용자·조직 관리 | 사용자, 조직 단위, 접근 권한 관리 |
| AD-06 | 질의 로그 조회 | 질의 이력, 응답 품질, LLM 선택 내역 |
| AD-07 | 스토리지 에이전트 관리 | 에이전트 배포 상태, 헬스 체크 |

---

## 4. 비기능 요구사항

| 항목 | 목표 |
|-----|-----|
| 인덱싱 지연 (고우선순위) | 이벤트 발생 후 즉시 인덱싱 ≤ 30초 |
| 인덱싱 지연 (저우선순위) | 배치 ≤ 1시간 |
| 질의 응답 시간 | P95 ≤ 3초 (스트리밍 첫 토큰 ≤ 1초) |
| 스토리지 커넥터 가용성 | 99.5% |
| 동시 질의 처리 | 100 RPS (초기 목표) |
| 문서 지원 형식 | PDF, DOCX, XLSX, PPTX, TXT, MD, HTML |
| 최대 단일 문서 크기 | 50MB |
| 보안 | JWT 인증, RBAC, TLS 1.3, 환경변수 기반 비밀 관리 |

---

## 5. 데이터 모델 (핵심)

### 5.1 주요 엔티티

```
storages               — 등록된 스토리지 커넥터
documents              — 문서 메타데이터 레지스트리 (원본 미저장)
document_index_status  — Vector/Vectorless 인덱스 상태
indexing_jobs          — 인덱싱 작업 큐 (우선순위, 상태)
policies               — 보안 등급·관할권별 정책 규칙
query_logs             — 질의 이력, LLM 선택, 응답 품질
users                  — 사용자, 조직, 권한
llm_providers          — LLM 제공자 설정 (API 키 암호화 저장)
agents                 — 스토리지 에이전트 등록 및 상태
```

---

## 6. 환경변수 구성

전체 구성은 `.env.example` 참조. 주요 그룹:

```
# Application
APP_ENV=development
APP_PORT=3000
APP_SECRET=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/docmonauto

# Redis
REDIS_URL=redis://localhost:6379

# LLM Providers
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
AWS_BEDROCK_ACCESS_KEY=
AWS_BEDROCK_SECRET_KEY=
AWS_BEDROCK_REGION=
OLLAMA_BASE_URL=http://localhost:11434

# Storage (예시 - 커넥터별 개별 설정)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
GCP_SERVICE_ACCOUNT_JSON=
AZURE_STORAGE_CONNECTION_STRING=

# Embedding
EMBEDDING_MODEL=bge-m3
EMBEDDING_BASE_URL=

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=7d
```

---

## 7. 개발 로드맵

### Phase 1: Foundation (MVP) — 4주

```
Week 1-2: 기반 인프라
  [ ] ops: Docker Compose (PostgreSQL, Redis, Backend, Frontend)
  [ ] database: 기본 스키마, pgvector 설정, 마이그레이션 도구
  [ ] backend: NestJS 프로젝트 초기화, Auth (JWT+RBAC), 기본 API
  [ ] frontend: Next.js 초기화, 로그인, 관리자 레이아웃

Week 3-4: 핵심 기능
  [ ] backend: AWS S3 커넥터 + 이벤트 수신
  [ ] backend: 정책 엔진 기본 규칙 (보안 등급 기반)
  [ ] backend: Vector 인덱싱 파이프라인 (OpenAI embedding)
  [ ] backend: 기본 RAG 질의 (단일 스토리지)
  [ ] frontend: 챗 인터페이스 (Browser 채널)
```

### Phase 2: Core Features — 4주

```
Week 5-6: 분산 인프라
  [ ] backend: GCP Storage 커넥터
  [ ] backend: 온프레미스 FileSystem Watcher 에이전트
  [ ] backend: 글로벌 인덱스 라우터 (분산 질의)
  [ ] backend: 우선순위 기반 증분 인덱싱 큐

Week 7-8: 고급 기능
  [ ] backend: Vectorless 인덱서
  [ ] backend: Vector+Vectorless 하이브리드 전환 로직
  [ ] backend: 멀티 LLM 오케스트레이터 (OpenAI + Ollama)
  [ ] frontend: 관리자 대시보드 (인덱싱 모니터링, 정책 관리)
```

### Phase 3: Advanced & Channels — 4주

```
Week 9-10: 멀티 LLM 확장
  [ ] backend: Google Gemini 어댑터
  [ ] backend: AWS Bedrock 어댑터
  [ ] backend: Azure Blob 커넥터
  [ ] backend: Naver/KT Cloud 커넥터

Week 11-12: 멀티 채널
  [ ] backend: MCP Server 구현
  [ ] backend: A2A 엔드포인트
  [ ] backend: REST API 공개 문서 (OpenAPI)
  [ ] ops: 프로덕션 배포 설정, 헬스체크, 모니터링
```

---

## 8. 카테고리별 개발 계획 (상세)

### 8.1 Database

**담당**: database/

- [ ] PostgreSQL 초기 스키마 설계 및 마이그레이션 (Flyway 또는 Prisma)
- [ ] pgvector 확장 설치 및 벡터 인덱스 설정 (ivfflat / hnsw)
- [ ] 핵심 테이블: storages, documents, document_index_status, indexing_jobs, policies, query_logs, users, llm_providers, agents
- [ ] 시드 데이터: 기본 정책 규칙, 테스트 사용자

### 8.2 Backend

**담당**: backend/ (NestJS)

모듈 구성:
```
backend/src/
├── auth/           # JWT, RBAC
├── storage/        # 커넥터 추상화 + AWS/GCP/Azure/온프레 구현
├── events/         # 이벤트 허브, 정규화, 라우팅
├── policy/         # 정책 엔진
├── indexing/       # 인덱싱 파이프라인, 우선순위 큐
├── index-router/   # 글로벌 인덱스 라우터
├── llm/            # LLM 어댑터 + 오케스트레이터
├── query/          # 질의 처리, 질의 로그
├── admin/          # 관리자 API
└── mcp/            # MCP Server
```

### 8.3 Frontend

**담당**: frontend/ (Next.js)

페이지 구성:
```
frontend/src/app/
├── (auth)/         # 로그인, 회원가입
├── (admin)/        # 관리자 페이지
│   ├── storages/   # 스토리지 커넥터 관리
│   ├── indexing/   # 인덱싱 모니터링
│   ├── policies/   # 정책 관리
│   └── llm/        # LLM 설정
└── chat/           # 문서 질의응답 챗 인터페이스
```

### 8.4 Ops

**담당**: ops/

- [ ] `docker-compose.yml` — 전체 스택 로컬 개발 환경
- [ ] `docker-compose.prod.yml` — 프로덕션 오버라이드
- [ ] 각 서비스 `Dockerfile` (multi-stage build)
- [ ] 헬스체크 엔드포인트 정의 (backend `/health`, frontend `/api/health`)
- [ ] `.env.example` — 전체 환경변수 템플릿
- [ ] `scripts/` — DB 초기화, 마이그레이션 실행, 에이전트 배포 스크립트

---

## 9. 제약 사항 및 전제 조건

- 문서 원본은 각 스토리지에서 이탈하지 않는 것을 아키텍처 원칙으로 한다
- 각 스토리지 제공자의 이벤트 API/SDK 접근 자격증명이 사전 준비되어야 한다
- 온프레미스 배포 LLM은 Ollama API 호환 인터페이스를 사용한다
- 모든 비밀(API 키, DB 비밀번호)은 환경변수로 관리하며 코드에 하드코딩 금지
- 초기 MVP는 단일 인스턴스 배포 (수평 확장은 Phase 3 이후)

---

## 10. 미결 사항 (Open Questions)

| # | 질문 | 결정 필요 |
|--|-----|---------|
| 1 | 임베딩 모델을 서비스별로 다르게 쓸 경우 벡터 공간 통일 방법? | 아키텍처 결정 필요 |
| 2 | Vectorless 인덱서 구현 방식 — PageIndex 방식 vs 자체 구현? | 기술 검토 필요 |
| 3 | 에이전트를 사이드카로 배포할지, 독립 서버로 배포할지? | 인프라 결정 필요 |
| 4 | 쿼리 로그의 개인정보 처리 방침 (질의 내용 저장 여부)? | 법무 검토 필요 |
| 5 | 멀티테넌시 지원 여부 (조직별 완전 격리 또는 소프트 격리)? | 제품 방향 결정 필요 |

---

*본 PRD는 사용자 검토 후 카테고리별(database → backend → frontend → ops) 순서로 개발을 진행합니다.*
