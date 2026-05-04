# DocMonAuto 테스트 시나리오

**버전**: v0.1.0  
**작성일**: 2026-04-30  
**대상**: DocMonAuto MVP P0 (Backend + Agent + Database)

---

## 개요

DocMonAuto의 핵심 기능을 기능별로 분류하여 단계적으로 검증한다. 각 테스트 케이스는 독립적으로 실행 가능하며, 전체 파이프라인 검증을 위해 순서대로 실행하는 것을 권장한다.

### 테스트 분류

| 스크립트 | 대상 | 핵심 검증 포인트 |
|---------|-----|----------------|
| `01_infra.sh` | 인프라 | 서비스 가동, DB 확장, 헬스체크 |
| `02_auth.sh` | 인증/인가 | JWT 발급, RBAC, 미인증 차단 |
| `03_storages.sh` | 스토리지 | CRUD, 활성화 토글, RBAC |
| `04_policies.sh` | 정책 | CRUD, 우선순위, 비활성 처리 |
| `05_indexing.sh` | 인덱싱 | 파일→에이전트→큐 파이프라인 |
| `06_search.sh` | 검색 | 벡터/FTS/RRF 정확성 |
| `07_query.sh` | RAG 질의 | 전체 파이프라인, 채널별 응답 |
| `08_admin.sh` | 관리자 API | 대시보드, Ping, 질의 로그 |

---

## 전제 조건

### 실행 환경

```
- PostgreSQL 16 (pgvector, pg_trgm, uuid-ossp 확장 활성화)
- Valkey 8 (또는 Redis 7)
- NestJS Backend: http://localhost:3001
- Python Agent: http://localhost:8080
- Python 3.x (json 파싱용)
- curl, bash
```

### 초기 데이터

`database/npm run db:seed` 실행 후 다음 계정이 존재해야 한다:

| 이메일 | 비밀번호 | 역할 |
|-------|--------|-----|
| admin@docmonauto.local | Admin1234! | SUPER_ADMIN |
| viewer@docmonauto.local | Viewer1234! | VIEWER |

### 환경변수 재정의

```bash
# 기본값 사용 (로컬 개발)
./run_all.sh

# 환경 재정의
BACKEND_URL=http://staging:3001 \
AGENT_URL=http://staging:8080 \
AGENT_SECRET=prod-secret \
./run_all.sh
```

### 감시 디렉토리

```bash
mkdir -p /tmp/docmonauto-watch
```

---

## TC-01: 인프라 헬스체크

**스크립트**: `01_infra.sh`  
**예상 소요 시간**: 10초 이내

### 목적

모든 서비스가 정상 기동 중이며, 필수 데이터베이스 확장이 활성화되어 있는지 확인한다. 이후 테스트의 전제 조건을 검증하는 가장 기본적인 테스트다.

### 테스트 케이스

#### TC-01-1: PostgreSQL 연결 확인

- **과정**: `pg_isready` 명령으로 DB 서버 응답 확인
- **예상 결과**: exit code 0 (accepting connections)
- **실패 시 조치**: `ops/docker compose up -d postgres` 또는 로컬 PostgreSQL 기동 확인

#### TC-01-2: pgvector 확장 활성화 확인

- **과정**: `pg_extension` 카탈로그에서 `vector` 확장 존재 여부 쿼리
- **예상 결과**: count = 1
- **실패 시 조치**:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

#### TC-01-3: Valkey(Redis) 연결 확인

- **과정**: `redis-cli ping` 명령으로 PONG 응답 확인
- **예상 결과**: `PONG`
- **실패 시 조치**: `ops/docker compose up -d valkey`

#### TC-01-4: NestJS Backend 헬스체크

- **과정**: `GET /health` 호출
- **예상 결과**: HTTP 200, `{"status":"ok"}`
- **실패 시 조치**: Backend 로그 확인 (`docker compose logs -f backend`)

#### TC-01-5: Python Agent 헬스체크

- **과정**: `GET http://localhost:8080/health` 호출
- **예상 결과**: HTTP 200, DB 연결 포함 정상 응답
- **실패 시 조치**: Agent 로그 확인, `.env` DATABASE_URL 확인

#### TC-01-6: Backend DB 연결 상태 확인

- **과정**: `/health` 응답의 `status` 필드 파싱
- **예상 결과**: `"ok"` 또는 Terminus 기반 상세 상태
- **참고**: DB 연결 실패 시 backend도 unhealthy로 응답

---

## TC-02: 인증 (Authentication)

**스크립트**: `02_auth.sh`  
**예상 소요 시간**: 10초 이내

### 목적

JWT 기반 인증 흐름과 RBAC(역할 기반 접근 제어)이 올바르게 동작하는지 검증한다. 미인증/권한 부족 요청이 명확히 차단되어야 한다.

### 테스트 케이스

#### TC-02-1: SUPER_ADMIN 로그인

- **과정**: `POST /api/v1/auth/login` (`email`, `password`)
- **예상 결과**: HTTP 200/201, `accessToken` 필드 존재
- **검증**: 토큰이 비어 있지 않음

#### TC-02-2: VIEWER 로그인

- **과정**: VIEWER 계정으로 동일 엔드포인트 호출
- **예상 결과**: HTTP 200/201, `accessToken` 수신
- **목적**: 일반 사용자 로그인 가능 여부 확인

#### TC-02-3: 잘못된 비밀번호 거부

- **과정**: 올바른 이메일 + 틀린 비밀번호
- **예상 결과**: HTTP 401 (Unauthorized)
- **목적**: 인증 실패 처리 검증

#### TC-02-4: 없는 계정 거부

- **과정**: 등록되지 않은 이메일로 로그인 시도
- **예상 결과**: HTTP 401 또는 404
- **목적**: 사용자 열거 공격 차단 확인

#### TC-02-5: 토큰 없이 보호된 API 접근

- **과정**: `Authorization` 헤더 없이 `GET /api/v1/storages`
- **예상 결과**: HTTP 401
- **목적**: 인증 가드(Guard) 동작 확인

#### TC-02-6: 유효한 토큰으로 보호된 API 접근

- **과정**: `Authorization: Bearer <token>`으로 동일 API
- **예상 결과**: HTTP 200
- **목적**: 정상 인증 흐름 end-to-end 확인

#### TC-02-7: VIEWER가 ADMIN 전용 API 접근

- **과정**: VIEWER 토큰으로 `POST /api/v1/storages` (ADMIN 필요)
- **예상 결과**: HTTP 403 (Forbidden)
- **목적**: 역할 기반 접근 제어(RBAC) 검증

---

## TC-03: 스토리지 관리

**스크립트**: `03_storages.sh`  
**예상 소요 시간**: 15초 이내

### 목적

스토리지 커넥터의 등록, 조회, 활성화 토글, 삭제 기능과 제공자별(ON_PREMISE, AWS_S3) 처리를 검증한다.

### 테스트 케이스

#### TC-03-1: 스토리지 목록 조회

- **과정**: `GET /api/v1/storages` (ADMIN 토큰)
- **예상 결과**: HTTP 200, JSON 배열
- **검증**: seed 데이터에 의해 최소 1개 이상 존재

#### TC-03-2: ON_PREMISE 스토리지 등록

- **과정**: `POST /api/v1/storages` `{name, provider:"ON_PREMISE", bucketOrPath}`
- **예상 결과**: HTTP 201, `id` 포함 응답, `isActive: true` (기본값)
- **목적**: 기본 등록 흐름 확인

#### TC-03-3: AWS S3 스토리지 등록

- **과정**: `provider:"AWS_S3"`, `bucketOrPath`, `region` 포함
- **예상 결과**: HTTP 201, 성공
- **목적**: 클라우드 스토리지 등록 경로 확인

#### TC-03-4: 스토리지 비활성화

- **과정**: `PATCH /api/v1/storages/:id/active` `{isActive: false}`
- **예상 결과**: HTTP 200, `isActive: false`
- **목적**: 스토리지 일시 비활성화 기능 확인

#### TC-03-5: 스토리지 재활성화

- **과정**: 동일 엔드포인트 `{isActive: true}`
- **예상 결과**: HTTP 200, `isActive: true`
- **목적**: 활성화 토글 양방향 동작 확인

#### TC-03-6: 스토리지 삭제 (SUPER_ADMIN)

- **과정**: `DELETE /api/v1/storages/:id`
- **예상 결과**: HTTP 200 또는 204
- **목적**: 삭제 권한 및 정리 동작 확인

---

## TC-04: 정책 관리

**스크립트**: `04_policies.sh`  
**예상 소요 시간**: 15초 이내

### 목적

보안 정책의 생성, 수정, 조회, 삭제를 검증한다. 보안 등급, 관할권, 인덱싱 전략, 허용 LLM의 조합이 올바르게 저장되는지 확인한다.

### 정책 평가 로직 (참고)

```
입력: {securityLevel, jurisdiction, orgUnit}
처리: 활성 정책을 priority DESC 순으로 순회 → 첫 매칭 정책 반환
출력: {strategy, allowedLlms, indexingLocation}
기본값: BOTH 전략 + 모든 LLM 허용
```

### 테스트 케이스

#### TC-04-1: 정책 목록 조회

- **과정**: `GET /api/v1/policies`
- **예상 결과**: HTTP 200, seed 데이터 정책 포함
- **검증**: SECRET, CONFIDENTIAL, INTERNAL 등급 정책 존재

#### TC-04-2: SECRET 등급 정책 생성

- **과정**: `POST /api/v1/policies`
  ```json
  {
    "securityLevels": ["SECRET"],
    "jurisdictions": ["KR"],
    "strategy": "VECTORLESS_ONLY",
    "allowedLlms": ["ollama"],
    "priority": 100
  }
  ```
- **예상 결과**: HTTP 201, `id` 반환
- **목적**: 최고 보안 등급 정책 — LLM을 온프레미스(ollama)로만 제한

#### TC-04-3: CONFIDENTIAL 등급 정책 생성

- **과정**: `securityLevels: ["CONFIDENTIAL"]`, `strategy: "BOTH"`, `allowedLlms: ["ollama","openai"]`
- **예상 결과**: HTTP 201
- **목적**: 중간 보안 등급 — 제한적 LLM 허용

#### TC-04-4: 정책 수정

- **과정**: `PUT /api/v1/policies/:id` (allowedLlms 변경)
- **예상 결과**: HTTP 200, 수정된 `allowedLlms` 반환
- **목적**: 정책 업데이트 동작 확인

#### TC-04-5: 비활성 정책 생성

- **과정**: `isActive: false`로 정책 생성
- **예상 결과**: HTTP 201, `isActive: false`
- **목적**: 비활성 정책은 평가 시 무시되어야 함

#### TC-04-6: 정책 삭제

- **과정**: `DELETE /api/v1/policies/:id`
- **예상 결과**: HTTP 200 또는 204
- **목적**: 테스트 데이터 정리 및 삭제 동작 확인

---

## TC-05: 문서 인덱싱 파이프라인

**스크립트**: `05_indexing.sh`  
**예상 소요 시간**: 30초 이내 (BGE-M3 임베딩 포함)

### 목적

파일 생성 → 에이전트 직접 인덱싱 → Backend 이벤트 API → BullMQ 큐 등록 → 인덱스 삭제 전체 파이프라인을 검증한다. VECTOR_ONLY, VECTORLESS_ONLY, BOTH 세 가지 전략을 모두 테스트한다.

### 인덱싱 흐름 (참고)

```
[파일 생성]
    │
    ├→ (watchdog) → POST /api/v1/internal/events/storage → Backend
    │                                                          │
    │                                             우선순위 스코어 계산
    │                                             BullMQ 큐 등록
    │                                             IndexingJob 생성
    │                                                          │
    └→ (직접) → POST /index (Agent)                   ┌──────▼──────┐
                    │                                  │  Processor  │
                    ├→ parse (Docling/텍스트)          │  POST /index │
                    ├→ chunk (sliding window)          └─────────────┘
                    ├→ vectorless (tsvector INSERT)
                    └→ vector (BGE-M3 + pgvector INSERT)
```

### 우선순위 스코어 계산 공식

```
Score = 0.4×queryFreq(정규화) + 0.3×securityWeight + 0.2×recency + 0.1×sizeInverse

처리 티어:
  Score ≥ 0.7 → 즉시 동기 (delay=0, 높은 BullMQ 우선순위)
  Score ≥ 0.3 → 준실시간 (delay=0, 일반 순서)
  Score < 0.3 → 배치 (delay=300,000ms)
```

### 테스트 케이스

#### TC-05-1: TXT 파일 인덱싱 (BOTH 전략)

- **과정**:
  1. `/tmp/docmonauto-watch/test-{ts}.txt` 파일 생성
  2. `POST http://localhost:8080/index` 호출 (`x-agent-secret` 헤더 포함)
  3. `strategy: "BOTH"` 지정
- **예상 결과**: HTTP 200/201, Vector + Vectorless 모두 인덱싱
- **검증**: `document_chunks` + `document_page_index` 양쪽에 레코드 생성

#### TC-05-2: VECTORLESS_ONLY 전략 인덱싱

- **과정**: `strategy: "VECTORLESS_ONLY"` 지정, 동일 에이전트 엔드포인트
- **예상 결과**: HTTP 200/201
- **목적**: BGE-M3 임베딩 없이 FTS만 인덱싱 (빠른 처리, 보안 문서용)
- **검증**: `document_page_index`에만 레코드 생성, `document_chunks` 미생성

#### TC-05-3: Backend 이벤트 API로 큐 등록

- **과정**: `POST /api/v1/internal/events/storage` (`x-agent-secret` 헤더)
  ```json
  {
    "eventType": "CREATE",
    "externalId": "/tmp/test.txt",
    "storageId": "<uuid>",
    "sizeBytes": 1024,
    "securityLevel": "INTERNAL"
  }
  ```
- **예상 결과**: HTTP 200/201, IndexingJob 생성 + BullMQ 등록
- **목적**: watchdog 이벤트 경로 시뮬레이션

#### TC-05-4: 인덱싱 큐 통계 확인

- **과정**: `GET /api/v1/indexing/stats`
- **예상 결과**: HTTP 200, `{waiting, active, completed, failed, delayed}` 필드
- **목적**: BullMQ 큐 상태 가시성 확인

#### TC-05-5: 인덱싱 작업 목록 확인

- **과정**: `GET /api/v1/indexing/jobs`
- **예상 결과**: HTTP 200, JobStatus(PENDING/PROCESSING/DONE/FAILED) 포함 배열
- **목적**: 작업 이력 추적 가능 여부 확인

#### TC-05-6: 인덱스 삭제

- **과정**: `POST http://localhost:8080/index/delete` `{"documentId": "<id>"}`
- **예상 결과**: HTTP 200/204
- **목적**: 문서 삭제 이벤트 처리, `document_chunks` + `document_page_index` 레코드 제거

---

## TC-06: 검색 기능

**스크립트**: `06_search.sh`  
**예상 소요 시간**: 30~60초 (임베딩 대기 포함)

### 목적

에이전트의 벡터 검색, FTS 검색, RRF 병합 검색이 의미적으로 관련성 있는 결과를 반환하는지 검증한다.

### 검색 전략별 동작 (참고)

| 전략 | 내부 동작 | 장점 | 단점 |
|-----|---------|-----|-----|
| VECTOR_ONLY | BGE-M3 코사인 유사도 | 의미 검색, 오타 허용 | 임베딩 시간 필요 |
| VECTORLESS_ONLY | PostgreSQL FTS (ts_rank) | 즉시 사용, 키워드 정밀 | 의미 유추 불가 |
| BOTH (RRF) | 두 결과 k=60 병합 | 균형 잡힌 품질 | 약간 복잡 |

### RRF 공식

```
RRF_score(d) = Σ 1 / (k + rank_i(d))
k = 60 (상수)
rank_i = 각 검색 방법에서의 순위
```

### 테스트 케이스

#### TC-06-1: 벡터 검색 (VECTOR_ONLY)

- **사전 준비**: 4개 문장 포함 txt 파일을 VECTOR_ONLY로 인덱싱
- **과정**: `POST /search` `{query:"의미 기반 유사 문서 검색", strategy:"VECTOR_ONLY", topK:3}`
- **예상 결과**: HTTP 200, 1~3개 결과, 각 결과에 `score` 포함
- **목적**: 쿼리 의미와 유사한 청크 반환 확인

#### TC-06-2: FTS 검색 (VECTORLESS_ONLY)

- **사전 준비**: 키워드 포함 문서를 VECTORLESS_ONLY로 인덱싱
- **과정**: `{query:"보안등급 정책엔진 키워드", strategy:"VECTORLESS_ONLY", topK:3}`
- **예상 결과**: HTTP 200, FTS 매칭 결과 반환
- **목적**: PostgreSQL `plainto_tsquery`를 통한 키워드 매칭 확인

#### TC-06-3: BOTH 검색 (RRF 병합)

- **사전 준비**: BOTH 전략으로 인덱싱된 문서
- **과정**: `{query:"분산 RAG 연합 검색", strategy:"BOTH", topK:5}`
- **예상 결과**: HTTP 200, 최대 5개 결과, 벡터+FTS 병합 순위
- **목적**: RRF 알고리즘 동작 확인, 결과 중복 제거 확인

#### TC-06-4: 빈 문서 목록 검색

- **과정**: `documentIds: []` 로 검색 요청
- **예상 결과**: HTTP 200, 빈 결과 배열 (오류 없음)
- **목적**: Edge case 처리 확인

---

## TC-07: RAG 질의응답 엔드투엔드

**스크립트**: `07_query.sh`  
**예상 소요 시간**: 60~120초 (LLM 응답 포함)

### 목적

문서 인덱싱 → Backend 정책 평가 → 연합 검색 → LLM 응답 생성 전체 파이프라인이 정상 동작하는지 검증한다.

### RAG 파이프라인 흐름 (참고)

```
POST /api/v1/query {query, channel}
    │
    ├→ 사용자 역할 → 보안 등급 매핑 (SUPER_ADMIN → SECRET 접근)
    ├→ PolicyService.evaluate() → strategy, allowedLlms
    ├→ IndexRouter.buildQueryPlan() → agent별 검색 그룹
    ├→ IndexRouter.search() → 병렬 에이전트 검색 + RRF 병합
    ├→ 컨텍스트 구성 (상위 N개 청크)
    ├→ LlmService.complete() → LLM 선택 + 응답 생성
    └→ QueryLog 저장 → 응답 반환
```

### 채널별 응답 형식

| 채널 | System Prompt 특성 |
|-----|------------------|
| BROWSER | Markdown 허용, 구조화된 응답 |
| API | 간결, JSON 친화적 |
| MCP | 컨텍스트 압축 |
| A2A | 순수 JSON |

### 테스트 케이스

#### TC-07-1: BROWSER 채널 RAG 질의

- **사전 준비**: 내용이 풍부한 txt 파일 인덱싱
- **과정**: `POST /api/v1/query` `{query:"DocMonAuto의 주요 특징은?", channel:"BROWSER"}`
- **예상 결과**: HTTP 200, `answer`, `sources`, `llmProvider`, `latencyMs` 포함
- **목적**: 전체 RAG 파이프라인 동작 확인
- **검증 포인트**:
  - `answer`가 비어있지 않음
  - `sources` 배열에 검색된 청크 정보 포함
  - `latencyMs`가 합리적 범위 (< 30,000ms)

#### TC-07-2: 질의 이력 조회

- **과정**: `GET /api/v1/query/history`
- **예상 결과**: HTTP 200, 방금 수행한 질의 포함
- **목적**: QueryLog 저장 확인

#### TC-07-3: API 채널 질의

- **과정**: `channel: "API"` 로 다른 질의
- **예상 결과**: HTTP 200, 간결한 응답
- **목적**: 채널별 다른 응답 스타일 확인

#### TC-07-4: 빈 쿼리 유효성 검사

- **과정**: `{query: ""}` 전송
- **예상 결과**: HTTP 400 또는 422 (ValidationPipe)
- **목적**: 입력 유효성 검증 확인

#### TC-07-5: 미인증 질의 거부

- **과정**: `Authorization` 헤더 없이 `POST /api/v1/query`
- **예상 결과**: HTTP 401
- **목적**: 보호된 엔드포인트 인증 가드 확인

---

## TC-08: 관리자 API

**스크립트**: `08_admin.sh`  
**예상 소요 시간**: 20초 이내

### 목적

관리자 대시보드 통계 조회, 에이전트 관리, 질의 로그, 에이전트 헬스 Ping 기능을 검증한다. VIEWER 계정의 관리자 API 차단도 함께 확인한다.

### 테스트 케이스

#### TC-08-1: 관리자 대시보드 통계

- **과정**: `GET /api/v1/admin/dashboard`
- **예상 결과**: HTTP 200
  ```json
  {
    "totalDocuments": <int>,
    "activeStorages": <int>,
    "pendingJobs": <int>,
    "onlineAgents": <int>,
    "recentJobs": [...],
    "recentQueries": [...]
  }
  ```
- **목적**: 관리자 개요 화면에 필요한 모든 지표 가용성 확인

#### TC-08-2: VIEWER의 대시보드 접근 차단

- **과정**: VIEWER 토큰으로 `GET /api/v1/admin/dashboard`
- **예상 결과**: HTTP 403
- **목적**: 관리자 전용 API RBAC 적용 확인

#### TC-08-3: 에이전트 목록 조회

- **과정**: `GET /api/v1/admin/agents`
- **예상 결과**: HTTP 200, seed 데이터 에이전트 포함
- **검증**: `id`, `name`, `endpoint`, `status` 필드 존재

#### TC-08-4: 새 에이전트 등록

- **과정**: `POST /api/v1/admin/agents` `{name, endpoint}`
- **예상 결과**: HTTP 201, 새 에이전트 `id` 반환
- **목적**: 에이전트 동적 등록 기능 확인

#### TC-08-5: 실제 에이전트 Ping

- **과정**: `POST /api/v1/admin/agents/:id/ping` (실제 실행 중인 에이전트)
- **예상 결과**: HTTP 200, `{status:"ONLINE", latencyMs:<int>}`
- **목적**: Backend → Agent HTTP 통신 + 상태 업데이트 확인

#### TC-08-6: 오프라인 에이전트 Ping

- **과정**: 존재하지 않는 엔드포인트의 에이전트 Ping
- **예상 결과**: HTTP 200 (에러 처리 후 OFFLINE 상태 반환) 또는 503
- **목적**: 에이전트 연결 실패 시 오류 처리 확인

#### TC-08-7: 전체 질의 로그 조회

- **과정**: `GET /api/v1/admin/query-logs`
- **예상 결과**: HTTP 200, 모든 사용자의 질의 이력 포함
- **목적**: 관리자의 시스템 전체 모니터링 가능 확인 (VIEWER는 본인 이력만)

---

## 실행 방법

### 사전 준비

```bash
cd test
chmod +x *.sh

# 감시 디렉토리 생성
mkdir -p /tmp/docmonauto-watch

# 환경 확인 (전체 스택이 실행 중이어야 함)
curl http://localhost:3001/health
curl http://localhost:8080/health
```

### 전체 테스트 실행

```bash
./run_all.sh
```

### 개별 테스트 실행

```bash
./01_infra.sh             # 인프라 헬스체크만
./02_auth.sh              # 인증만
./05_indexing.sh          # 인덱싱만
```

### 특정 테스트만 선택 실행

```bash
./run_all.sh 01 02 05     # 인프라 + 인증 + 인덱싱
./run_all.sh 07           # RAG 질의만
```

### 환경 재정의 실행

```bash
BACKEND_URL=http://staging:3001 \
AGENT_URL=http://staging:8080 \
ADMIN_PASSWORD=StagingAdmin1234! \
./run_all.sh
```

---

## 로그 및 결과

실행 결과는 `test/logs/YYYYMMDD_HHMMSS/` 디렉토리에 스크립트별로 저장된다.

```
test/logs/
└── 20260430_153000/
    ├── 01_infra.log
    ├── 02_auth.log
    ├── 03_storages.log
    ├── 04_policies.log
    ├── 05_indexing.log
    ├── 06_search.log
    ├── 07_query.log
    └── 08_admin.log
```

PASS/FAIL 집계:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  전체 테스트 결과 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  총 PASS: 42
  총 FAIL: 0
  총 SKIP: 1
  모든 테스트 통과!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 알려진 제약 및 참고 사항

1. **TC-06, TC-07**: BGE-M3 임베딩 모델 초기 로드 시 수 분 소요 (첫 실행)
2. **TC-07**: LLM 응답은 Ollama 또는 OpenAI API Key 설정 필요. 미설정 시 TC-07 일부 실패 예상
3. **TC-05-3**: Backend 이벤트 API 경유 인덱싱은 BullMQ가 에이전트에 전달하는 비동기 흐름이므로, 즉시 인덱스 확인이 안 될 수 있음 (완료까지 수 초 소요)
4. **SKIP 케이스**: `redis-cli` 미설치, LLM 미설정 등 환경적 이유로 일부 테스트가 SKIP될 수 있으며 이는 정상
5. **테스트 격리**: 각 스크립트는 생성한 데이터를 사후 정리(`DELETE`)함. 단, `08_admin.sh`의 테스트 에이전트는 수동 삭제 필요
