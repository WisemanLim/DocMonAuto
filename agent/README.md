# Agent — Python FastAPI 스토리지 에이전트

각 스토리지 위치에 배포되는 로컬 인덱싱 에이전트. 파일시스템 감시, 문서 파싱, 벡터 임베딩, pgvector/FTS 인덱싱, 검색을 담당합니다.

---

## 핵심 원칙

> **문서 원본은 에이전트 밖으로 전송하지 않습니다.**  
> NestJS 백엔드에는 이벤트 메타데이터만 전달하고, 실제 파싱·임베딩·저장은 에이전트 로컬에서 수행합니다.

---

## 기술 스택

| 항목 | 라이브러리 | 라이선스 |
|-----|----------|---------|
| 웹 프레임워크 | FastAPI + Uvicorn | MIT |
| 문서 파싱 | Docling (IBM) | MIT |
| 임베딩 모델 | BGE-M3 (sentence-transformers) | MIT |
| 파일 감시 | watchdog | Apache 2.0 |
| DB 드라이버 | asyncpg + pgvector | MIT |
| HTTP 클라이언트 | httpx | BSD |
| 설정 관리 | pydantic-settings | MIT |

---

## 지원 문서 형식

| 형식 | 파서 |
|-----|-----|
| PDF | Docling |
| DOCX / DOC | Docling / python-docx |
| PPTX | Docling (fallback) |
| TXT / MD / HTML | 텍스트 직접 청킹 |

---

## 인덱싱 전략

| 전략 | 방식 | 테이블 | 특징 |
|-----|-----|-------|-----|
| `VECTOR_ONLY` | BGE-M3 임베딩 → pgvector | `document_chunks` | 의미 기반 검색 |
| `VECTORLESS_ONLY` | PostgreSQL FTS | `document_page_index` | 빠른 키워드 검색, 임베딩 불필요 |
| `BOTH` | Vector + Vectorless 이중 인덱싱 | 양쪽 | 기본값, Phase 1은 Vectorless 우선 |

검색 결과는 **RRF (Reciprocal Rank Fusion)**으로 통합됩니다.

---

## 전제 조건

- Python 3.12+
- PostgreSQL 실행 중 (pgvector, pg_trgm 확장 활성화)
- NestJS 백엔드 실행 중 (`BACKEND_URL` 설정)

---

## 개발 모드 (Development)

### 가상환경 설정

```bash
cd agent

# 가상환경 생성
python3.12 -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate   # Windows

# 의존성 설치
pip install -r requirements.txt
```

> **주의**: `docling`과 `sentence-transformers`는 초기 설치 시 모델 파일을 다운로드합니다 (BGE-M3 약 2.3GB). 첫 실행에 수 분 소요됩니다.

### 환경변수

루트 `.env` 또는 `agent/.env` 생성:

```env
DATABASE_URL=postgresql://docmonauto:password@localhost:5432/docmonauto
BACKEND_URL=http://localhost:3001
AGENT_PORT=8080
AGENT_SECRET=dev-agent-secret
WATCH_PATH=/tmp/docmonauto-watch
STORAGE_ID=00000000-0000-0000-0000-000000000010

# 임베딩 설정
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIMENSIONS=1024
EMBEDDING_DEVICE=cpu        # cpu | cuda | mps (Apple Silicon)
```

### 감시 디렉토리 생성

```bash
mkdir -p /tmp/docmonauto-watch
```

### 실행

```bash
# 개발 모드 (자동 재시작)
uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# 또는
python main.py
```

### 동작 확인

```bash
# 헬스체크
curl http://localhost:8080/health

# 수동 인덱싱 테스트 (NestJS 없이)
curl -X POST http://localhost:8080/index \
  -H "x-agent-secret: dev-agent-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "test-doc-001",
    "externalId": "/tmp/docmonauto-watch/test.txt",
    "storageId": "00000000-0000-0000-0000-000000000010",
    "eventType": "CREATE",
    "strategy": "BOTH"
  }'

# 검색 테스트
curl -X POST http://localhost:8080/search \
  -H "x-agent-secret: dev-agent-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "테스트 문서",
    "documentIds": ["test-doc-001"],
    "strategy": "BOTH",
    "topK": 5
  }'
```

### 파일 감시 테스트

```bash
# 감시 디렉토리에 파일 추가 → NestJS로 자동 이벤트 전송
echo "테스트 문서 내용입니다." > /tmp/docmonauto-watch/sample.txt

# agent 로그 확인
# INFO  watcher.notified event=CREATE file=sample.txt status=200
```

---

## 프로덕션 모드 (Production)

### Docker로 실행

```bash
# 이미지 빌드
docker build -t docmonauto-agent .

# 실행 (로컬 파일 마운트)
docker run -p 8080:8080 \
  --env-file ../.env.prod \
  -v /path/to/watch:/watch:ro \
  docmonauto-agent
```

### Docker Compose로 실행 (권장)

```bash
cd ops
docker compose up -d agent
```

### 프로덕션 체크리스트

- [ ] `AGENT_SECRET` 64자 이상 (백엔드와 동일한 값)
- [ ] `EMBEDDING_DEVICE=cuda` (GPU 서버) 또는 `mps` (Apple Silicon)
- [ ] `APP_ENV=production` (uvicorn reload 비활성화)
- [ ] `WATCH_PATH`를 실제 스토리지 마운트 경로로 변경
- [ ] `STORAGE_ID`를 DB에 등록된 실제 스토리지 ID로 변경

### GPU 사용 (고성능 임베딩)

```env
EMBEDDING_DEVICE=cuda   # NVIDIA GPU
# 또는
EMBEDDING_DEVICE=mps    # Apple Silicon
```

GPU Dockerfile (CUDA 지원):

```dockerfile
FROM nvidia/cuda:12.4-runtime-ubuntu22.04
# ... requirements.txt 설치 후 동일
```

---

## 엔드포인트

| Method | Path | 인증 | 설명 |
|--------|------|-----|-----|
| GET | `/health` | 없음 | 헬스체크 (DB 연결 포함) |
| POST | `/index` | `x-agent-secret` | 문서 인덱싱 (Vector + Vectorless) |
| POST | `/index/delete` | `x-agent-secret` | 문서 인덱스 삭제 |
| POST | `/search` | `x-agent-secret` | 문서 검색 (vector/vectorless/both) |

### POST /index 요청 형식

```json
{
  "documentId": "uuid-from-backend",
  "externalId": "/watch/path/to/document.pdf",
  "storageId": "storage-uuid",
  "eventType": "CREATE",
  "strategy": "BOTH",
  "securityLevel": "INTERNAL",
  "contentType": "application/pdf",
  "metadata": {}
}
```

### POST /search 요청 형식

```json
{
  "query": "검색할 내용",
  "documentIds": ["doc-id-1", "doc-id-2"],
  "strategy": "BOTH",
  "topK": 5
}
```

---

## 환경변수 전체 목록

| 변수 | 기본값 | 필수 | 설명 |
|-----|-------|-----|-----|
| `DATABASE_URL` | — | ✅ | PostgreSQL 연결 URL |
| `BACKEND_URL` | `http://backend:3001` | ✅ | NestJS 백엔드 URL |
| `AGENT_PORT` | `8080` | | 에이전트 서버 포트 |
| `AGENT_SECRET` | `dev-agent-secret` | ✅ | 백엔드와 공유하는 인증 비밀 |
| `WATCH_PATH` | `/watch` | | 감시할 파일시스템 경로 |
| `STORAGE_ID` | `00000000-...0010` | ✅ | DB에 등록된 스토리지 UUID |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | | HuggingFace 임베딩 모델 ID |
| `EMBEDDING_DIMENSIONS` | `1024` | | 임베딩 벡터 차원 수 |
| `EMBEDDING_DEVICE` | `cpu` | | 임베딩 연산 장치 |
| `APP_ENV` | `development` | | 실행 환경 |
| `LOG_LEVEL` | `INFO` | | 로그 레벨 |

---

## 문제 해결

**BGE-M3 모델 다운로드 실패**
```bash
# HuggingFace 미러 사용
HF_ENDPOINT=https://hf-mirror.com pip install -r requirements.txt
```

**pgvector 확장 없음 오류**
```bash
# PostgreSQL에서 확장 활성화
psql -U docmonauto -d docmonauto -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**watchdog가 이벤트를 감지하지 못함**
```bash
# Linux에서 inotify 한도 증가
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**임베딩 차원 불일치**
- `EMBEDDING_DIMENSIONS`와 DB의 `vector(N)` 타입이 일치해야 합니다
- BGE-M3 기본값: 1024. 다른 모델 사용 시 seed.ts의 ALTER TABLE도 수정 필요
