# Backend — NestJS API 서버

DocMonAuto의 핵심 비즈니스 로직 서버. 정책 엔진, 인덱싱 큐, LLM 오케스트레이터, RAG 질의 파이프라인을 포함합니다.

---

## 기술 스택

| 항목 | 내용 |
|-----|-----|
| 프레임워크 | NestJS 10 + Fastify |
| 언어 | TypeScript 5.x |
| ORM | Prisma 5.x |
| 큐 | BullMQ (Valkey/Redis) |
| 인증 | JWT (passport-jwt) |
| 문서화 | Swagger (OpenAPI) |
| 로깅 | nestjs-pino |

---

## 모듈 구조

```
src/
├── main.ts              ← 앱 진입점 (Fastify, CORS, Swagger, ValidationPipe)
├── app.module.ts        ← 전체 모듈 조합, BullMQ/Config 글로벌 설정
├── prisma/              ← Global PrismaService
├── auth/                ← JWT 발급/검증, Passport strategy
├── users/               ← 사용자 CRUD, RBAC
├── storages/            ← 스토리지 커넥터 관리 (AES-256-GCM 자격증명 암호화)
├── events/              ← 스토리지 이벤트 허브 + 우선순위 스코어링
├── policy/              ← 보안등급·관할권 기반 정책 평가 엔진
├── indexing/            ← BullMQ 우선순위 큐 + Processor → agent HTTP
├── index-router/        ← Federated search 플래닝 + RRF merge
├── llm/                 ← OpenAI / Ollama / Google 어댑터
├── query/               ← 전체 RAG 파이프라인 (policy→search→LLM→log)
├── admin/               ← 대시보드, 에이전트 관리, 쿼리 로그
└── health/              ← DB + memory 헬스체크 (Terminus)
```

---

## 전제 조건

- Node.js 22+
- PostgreSQL 실행 중 + 마이그레이션 완료
- Valkey (또는 Redis) 실행 중
- Python Agent 실행 중 (`http://localhost:8080`)

---

## 개발 모드 (Development)

### 설치

```bash
cd backend
npm install
```

### 환경변수

루트의 `.env` 파일을 사용합니다. 필수 변수:

```env
APP_ENV=development
APP_PORT=3001
APP_SECRET=change-me-32-chars-minimum-here!
DATABASE_URL=postgresql://docmonauto:password@localhost:5432/docmonauto
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=change-me-jwt-secret-min-32-chars
AGENT_SECRET=dev-agent-secret
AGENT_BASE_URL=http://localhost:8080
OLLAMA_BASE_URL=http://localhost:11434
```

### 실행 (핫리로드)

```bash
npm run start:dev
# 소스 변경 시 자동 재시작
# 포트: http://localhost:3001
```

### Docker 없이 단독 실행

```bash
# PostgreSQL과 Valkey가 로컬에서 실행 중이어야 함
npm run start:dev
```

### Swagger UI

개발 모드에서 자동으로 활성화됩니다:

```
http://localhost:3001/api/docs
```

### 린트 & 타입 체크

```bash
npm run lint          # ESLint
npx tsc --noEmit     # TypeScript 타입 체크
```

### 테스트

```bash
npm test              # Jest 단위 테스트
npm test -- --watch  # watch 모드
```

---

## 프로덕션 모드 (Production)

### 빌드

```bash
npm run build
# dist/ 디렉토리에 컴파일 결과 생성
```

### 실행

```bash
NODE_ENV=production node dist/main
```

### Docker로 실행

```bash
# 프로덕션 이미지 빌드
docker build --target production -t docmonauto-backend .

# 실행
docker run -p 3001:3001 \
  --env-file ../.env.prod \
  docmonauto-backend
```

### 프로덕션 체크리스트

- [ ] `APP_SECRET` 64자 이상 랜덤 문자열
- [ ] `JWT_SECRET` 64자 이상 랜덤 문자열
- [ ] `AGENT_SECRET` 64자 이상 랜덤 문자열
- [ ] `APP_ENV=production` 설정 (pino-pretty 비활성화)
- [ ] `LOG_LEVEL=warn` 설정
- [ ] `CORS_ORIGIN` 실제 프론트엔드 도메인으로 변경
- [ ] TLS 종료는 Nginx/로드밸런서에서 처리

---

## API 엔드포인트 목록

### 인증

| Method | Path | 인증 | 설명 |
|--------|------|-----|-----|
| POST | `/api/v1/auth/login` | 없음 | 이메일/비밀번호 → JWT 반환 |

### 질의

| Method | Path | 인증 | 설명 |
|--------|------|-----|-----|
| POST | `/api/v1/query` | JWT | RAG 질의응답 |
| GET | `/api/v1/query/history` | JWT | 내 질의 이력 |

### 스토리지

| Method | Path | 역할 | 설명 |
|--------|------|-----|-----|
| GET | `/api/v1/storages` | 로그인 | 스토리지 목록 |
| POST | `/api/v1/storages` | ADMIN+ | 스토리지 등록 |
| PATCH | `/api/v1/storages/:id/active` | ADMIN+ | 활성화/비활성화 |
| DELETE | `/api/v1/storages/:id` | SUPER_ADMIN | 삭제 |

### 정책

| Method | Path | 역할 | 설명 |
|--------|------|-----|-----|
| GET | `/api/v1/policies` | 로그인 | 정책 목록 |
| POST | `/api/v1/policies` | ADMIN+ | 정책 생성 |
| PUT | `/api/v1/policies/:id` | ADMIN+ | 정책 수정 |
| DELETE | `/api/v1/policies/:id` | SUPER_ADMIN | 정책 삭제 |

### 인덱싱

| Method | Path | 역할 | 설명 |
|--------|------|-----|-----|
| GET | `/api/v1/indexing/stats` | 로그인 | 큐 통계 |
| GET | `/api/v1/indexing/jobs` | 로그인 | 최근 작업 목록 |

### 관리자

| Method | Path | 역할 | 설명 |
|--------|------|-----|-----|
| GET | `/api/v1/admin/dashboard` | ADMIN+ | 전체 현황 |
| GET | `/api/v1/admin/agents` | ADMIN+ | 에이전트 목록 |
| POST | `/api/v1/admin/agents` | SUPER_ADMIN | 에이전트 등록 |
| POST | `/api/v1/admin/agents/:id/ping` | ADMIN+ | 에이전트 헬스 확인 |
| GET | `/api/v1/admin/query-logs` | ADMIN+ | 전체 질의 로그 |

### 내부 (에이전트 전용)

| Method | Path | 인증 | 설명 |
|--------|------|-----|-----|
| POST | `/api/v1/internal/events/storage` | `x-agent-secret` 헤더 | 스토리지 이벤트 수신 |

### 시스템

| Method | Path | 설명 |
|--------|------|-----|
| GET | `/health` | 헬스체크 (DB, 메모리) |
| GET | `/api/docs` | Swagger UI |

---

## 인덱싱 우선순위 로직

이벤트 수신 시 Priority Score 계산:

```
Priority_Score =
  0.4 × query_frequency_30d (정규화)   ← 최근 30일 해당 문서 질의 횟수
  0.3 × security_weight                ← SECRET=1.0, CONFIDENTIAL=0.8, ...
  0.2 × recency_weight                 ← 항상 1.0 (신규 이벤트)
  0.1 × size_inverse_weight            ← 소형 문서 우선

처리 티어:
  Score ≥ 0.7 → 즉시 동기 인덱싱 (delay=0)
  Score ≥ 0.3 → 준실시간 큐 (delay=0, BullMQ 순서 보장)
  Score < 0.3 → 배치 인덱싱 (delay=5분)
```

---

## 환경변수 전체 목록

| 변수 | 기본값 | 필수 | 설명 |
|-----|-------|-----|-----|
| `APP_ENV` | `development` | | 실행 환경 |
| `APP_PORT` | `3001` | | 서버 포트 |
| `APP_SECRET` | — | ✅ | 스토리지 자격증명 암호화 키 (32자+) |
| `CORS_ORIGIN` | `*` | | CORS 허용 오리진 |
| `DATABASE_URL` | — | ✅ | PostgreSQL 연결 URL |
| `REDIS_HOST` | `localhost` | | Valkey 호스트 |
| `REDIS_PORT` | `6379` | | Valkey 포트 |
| `REDIS_PASSWORD` | — | | Valkey 비밀번호 |
| `JWT_SECRET` | `dev-secret` | ✅ | JWT 서명 키 |
| `JWT_EXPIRES_IN` | `7d` | | JWT 만료 시간 |
| `AGENT_SECRET` | `dev-agent-secret` | ✅ | 에이전트 인증 공유 비밀 |
| `AGENT_BASE_URL` | `http://agent:8080` | | 기본 에이전트 URL |
| `OPENAI_API_KEY` | — | | OpenAI API 키 |
| `OPENAI_DEFAULT_MODEL` | `gpt-4o-mini` | | 기본 OpenAI 모델 |
| `GOOGLE_AI_API_KEY` | — | | Google AI API 키 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | | Ollama 서버 URL |
| `OLLAMA_DEFAULT_MODEL` | `llama3.2` | | 기본 Ollama 모델 |
| `LOG_LEVEL` | `info` | | 로그 레벨 |
