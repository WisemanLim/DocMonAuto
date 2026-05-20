# Database — Prisma 스키마 & 마이그레이션

DocMonAuto의 PostgreSQL 데이터베이스 스키마 및 마이그레이션 관리.

---

## 기술 스택

| 항목 | 내용 |
|-----|-----|
| DBMS | PostgreSQL 16 |
| 확장 | pgvector, uuid-ossp, pg_trgm |
| ORM | Prisma 5.x |
| 언어 | TypeScript (ts-node) |

---

## 데이터 모델

```
users                    ← 사용자, 역할(SUPER_ADMIN/ADMIN/EDITOR/VIEWER)
agents                   ← 스토리지 에이전트 등록 및 상태
storages                 ← 스토리지 커넥터 (AWS/GCP/Azure/온프레미스)
documents                ← 문서 메타데이터 레지스트리 (원본 미저장)
document_index_status    ← Vector/Vectorless 인덱스 상태 추적
indexing_jobs            ← BullMQ 인덱싱 작업 큐 (우선순위, 상태)
policies                 ← 보안등급·관할권 기반 정책 규칙
llm_providers            ← LLM 제공자 설정 (API 키 암호화)
query_logs               ← 질의 이력, LLM 선택, 응답 품질

--- Python 에이전트가 직접 관리 ---
document_chunks          ← 벡터 임베딩 청크 (embedding vector(1024))
document_page_index      ← Vectorless FTS 인덱스 (search_vector tsvector)
```

---

## 전제 조건

- Node.js 22+
- PostgreSQL 16 실행 중 (또는 `ops/docker compose up -d postgres`)
- `DATABASE_URL` 환경변수 설정

---

## 개발 모드 (Development)

### 설치

```bash
cd database
npm install
```

### 환경변수

프로젝트 **루트의 `.env`** 를 두는 것을 권장합니다 (`database/prisma/seed.ts` 가 자동으로 읽습니다).

**주의:** `DATABASE_PASSWORD`(Docker Compose의 `POSTGRES_PASSWORD`와 동일)만 바꾸고 `DATABASE_URL` 안의 비밀번호는 그대로 두면 `Authentication failed` 가 납니다. 시드 스크립트는 **`DATABASE_PASSWORD`가 설정되어 있으면 `DATABASE_URL`을 호스트·포트·유저와 함께 다시 조립**합니다.

환경 시험 시나리오는 저장소 [`.test/`](../.test/) 디렉터리를 참고하세요.

```bash
# 루트 .env 예시 — DATABASE_PASSWORD와 URL 속 비밀번호를 반드시 일치시키거나,
# 분해 변수(DATABASE_*)만 맞추고 시드/앱이 URL을 맞추도록 둡니다.
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=docmonauto
DATABASE_USER=docmonauto
DATABASE_PASSWORD=실제-DB-비밀번호
DATABASE_URL=postgresql://docmonauto:실제-DB-비밀번호@localhost:5432/docmonauto
```

`database/prisma/.env` 를 따로 쓸 경우 Prisma CLI(`migrate`, `studio`)는 그 파일을 우선할 수 있으니, 루트 `.env` 와 동일한 연결 정보를 유지하세요.

### 마이그레이션 실행 (개발)

```bash
# 스키마 변경 후 마이그레이션 파일 생성 + DB 적용
npm run db:migrate
# 프롬프트에서 마이그레이션 이름 입력 (예: add_indexing_jobs)

# 스키마만 빠르게 DB에 반영 (마이그레이션 파일 생성 없음, 개발 초기용)
npm run db:push
```

### Prisma Client 재생성

```bash
# schema.prisma 수정 후 클라이언트 타입 재생성
npm run db:generate
```

### 시드 데이터 투입

```bash
# 기본 정책, LLM 제공자, 테스트 계정 생성
npm run db:seed
```

생성 데이터:

| 유형 | 내용 |
|-----|-----|
| 사용자 | `admin@docmonauto.local` (SUPER_ADMIN), `viewer@docmonauto.local` (VIEWER) |
| 에이전트 | Local Dev Agent (`http://agent:8080`) |
| 스토리지 | Local Dev Storage (ON_PREMISE, `/watch`) |
| 정책 | SECRET → Vectorless+온프레 / CONFIDENTIAL → Both+KR LLM / INTERNAL 이하 → 제한 없음 |
| LLM 제공자 | openai, google, aws-bedrock, ollama |

### Prisma Studio (데이터 시각화)

```bash
npm run db:studio
# 브라우저에서 http://localhost:5555 접속
```

### DB 초기화 (전체 삭제 후 재시작)

```bash
npm run db:reset
# 경고: 모든 데이터 삭제 후 마이그레이션 + 시드 재실행
```

---

## 프로덕션 모드 (Production)

### 마이그레이션 배포

```bash
# 프로덕션에서는 db:migrate 대신 db:migrate:prod 사용
# (마이그레이션 파일만 적용, 스키마 드리프트 검사)
DATABASE_URL="postgresql://..." npm run db:migrate:prod
```

Docker 컨테이너 내에서 실행 시:

```bash
docker compose exec backend \
  sh -c "cd /app && npx prisma migrate deploy \
         --schema=/database/prisma/schema.prisma"
```

### 주의 사항

- **`db:push`는 프로덕션에서 사용 금지** (마이그레이션 이력 없이 직접 변경)
- **`db:reset`은 프로덕션에서 사용 금지** (전체 데이터 삭제)
- 프로덕션 API 키(`apiKeyEnc`)는 AES-256-GCM으로 암호화되어 저장됨
- `APP_SECRET` 환경변수가 변경되면 기존 암호화 데이터 복호화 불가

---

## 스키마 수정 워크플로우

```bash
# 1. prisma/schema.prisma 수정
# 2. 클라이언트 재생성
npm run db:generate

# 3. 개발 DB에 적용
npm run db:migrate
# 마이그레이션 이름 입력 (영문, 언더스코어)

# 4. backend에서 import 확인
# @prisma/client 타입이 자동 업데이트됨
```

---

## pgvector 관련 특이사항

`document_chunks.embedding` 컬럼은 Prisma `Unsupported("vector(1024)")` 타입으로 정의되어 있어 Prisma Client로 직접 쓰기/읽기가 불가합니다.

- **쓰기**: Python 에이전트(`asyncpg` + `pgvector`)가 직접 처리
- **읽기**: Python 에이전트의 `/search` 엔드포인트 경유
- **인덱스**: `embedding <=> vector_cosine_ops` HNSW 인덱스 (seed.ts에서 생성)

`document_page_index.search_vector`는 `GENERATED ALWAYS AS` tsvector 컬럼으로, PostgreSQL이 자동 관리합니다.
