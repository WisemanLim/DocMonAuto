# Ops — Docker Compose 환경 구성

DocMonAuto 전체 스택의 컨테이너 오케스트레이션 및 인프라 설정.

---

## 구성 서비스

| 서비스 | 이미지 | 포트 | 역할 |
|-------|-------|-----|-----|
| `postgres` | `pgvector/pgvector:pg16` | 5432 | PostgreSQL + pgvector 확장 |
| `valkey` | `valkey/valkey:8-alpine` | 6379 | Redis 호환 메시지 큐 (BSD-3) |
| `backend` | 로컬 빌드 | 3001 | NestJS API 서버 |
| `frontend` | 로컬 빌드 | 3000 | Next.js 웹 UI |
| `agent` | 로컬 빌드 | 8080 | Python 스토리지 에이전트 |

---

## 전제 조건

- Docker Engine 24+ 및 Docker Compose v2
- 루트에 `.env` 파일 생성 완료 (`.env.example` 참고)
- 로컬 단독 실행과 Compose가 동시에 만족하는 설정은 [`.test/scenario-docker-compose.md`](../.test/scenario-docker-compose.md) 참고

---

## 개발 모드 (Development)

### 최초 설정

```bash
# 프로젝트 루트에서 환경변수 설정
cp .env.example .env

# 필수 값 수정 (최소한 아래 3개)
# DATABASE_PASSWORD=your-db-password
# JWT_SECRET=your-32-chars-min-secret
# AGENT_SECRET=your-agent-secret

# 로컬 파일 감시 디렉토리 생성
mkdir -p /tmp/docmonauto-watch
```

### 스택 실행

```bash
cd ops

# Compose가 ${DATABASE_*} 치환에 쓰는 ops/.env ← 루트 .env 링크 (최초 1회)
ln -sf ../.env .env

# 전체 스택 시작 (백그라운드)
./up -d
# 또는: docker compose up -d   (ops/.env 가 있을 때)

# 로그 확인
docker compose logs -f

# 특정 서비스 로그만
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f agent
```

### 개발 중 핫리로드

backend, agent, frontend는 개발 모드에서 소스 볼륨 마운트로 핫리로드됩니다.

```bash
# backend: src/ 변경 시 자동 재시작 (nest start --watch)
# agent: uvicorn --reload 모드
# frontend: next dev (0.0.0.0 바인딩)

# 서비스 재빌드가 필요한 경우 (의존성 변경 시)
docker compose build backend
docker compose build agent
docker compose build frontend
docker compose up -d backend agent frontend
```

### DB 초기화 (최초 1회)

```bash
# postgres 컨테이너가 healthy 상태가 된 후 실행
cd ../database
npm install
npm run db:migrate   # Prisma 마이그레이션 실행
npm run db:seed      # 기본 데이터 시드 (관리자 계정, 기본 정책, LLM 제공자)
```

기본 생성 계정:

| 이메일 | 비밀번호 | 역할 |
|-------|--------|-----|
| `admin@docmonauto.local` | `Admin1234!` | SUPER_ADMIN |
| `viewer@docmonauto.local` | `Viewer1234!` | VIEWER |

### 서비스 중지

```bash
cd ops
docker compose down          # 컨테이너 중지 (볼륨 유지)
docker compose down -v       # 컨테이너 + 볼륨 전체 삭제 (DB 초기화)
```

---

## 프로덕션 모드 (Production)

### 환경변수 준비

프로덕션 전용 `.env.prod` 파일 생성:

```bash
cp .env.example .env.prod
```

필수 변경 항목:

```env
APP_ENV=production
APP_SECRET=<64자 이상 랜덤 문자열>
DATABASE_PASSWORD=<강력한 DB 비밀번호>
JWT_SECRET=<64자 이상 랜덤 문자열>
AGENT_SECRET=<64자 이상 랜덤 문자열>
REDIS_PASSWORD=<Valkey 비밀번호>
OPENAI_API_KEY=<실제 API 키>   # 또는 사용할 LLM 키
LOG_LEVEL=warn
```

### 프로덕션 실행

```bash
cd ops

# 이미지 빌드 (production target 사용)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file ../.env.prod build

# 실행
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file ../.env.prod up -d

# 프로덕션 DB 마이그레이션 (down-time 없는 deploy 방식)
docker compose exec backend \
  npx prisma migrate deploy --schema=../database/prisma/schema.prisma
```

### 헬스체크 확인

```bash
# backend
curl http://localhost:3001/v1/health

# agent
curl http://localhost:8080/health

# postgres
docker compose exec postgres pg_isready -U docmonauto -d docmonauto

# valkey
docker compose exec valkey valkey-cli ping
```

---

## 서비스 의존성 순서

```
postgres (healthy)
    └── valkey (healthy)
            └── backend (healthy)
                    ├── frontend
                    └── agent
```

Docker Compose `depends_on.condition: service_healthy`로 자동 제어됩니다.

---

## 볼륨 관리

| 볼륨 | 내용 |
|-----|-----|
| `postgres_data` | PostgreSQL 데이터 파일 |
| `valkey_data` | Valkey 영속 데이터 |
| `${LOCAL_WATCH_PATH}` | 온프레미스 에이전트 감시 디렉토리 (호스트 마운트, read-only) |

---

## 문제 해결

**postgres 컨테이너가 시작 안 됨**
```bash
docker compose logs postgres
# pgvector 이미지 pull 실패 시:
docker pull pgvector/pgvector:pg16
```

**backend가 unhealthy (`Exec format error`, bcrypt)**

호스트(Mac)에서 설치한 `node_modules`가 Compose 익명 볼륨에 섞이면 Linux 컨테이너에서 네이티브 모듈이 깨질 수 있습니다. 현재 백엔드는 **`bcryptjs`(순수 JS)** 를 사용합니다. 이미지 재빌드 후 다시 기동하세요.

```bash
docker compose logs backend --tail 80
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

**agent가 backend에 연결 못 함**
```bash
# backend가 healthy 상태인지 확인
docker compose ps
# AGENT_SECRET과 backend의 AGENT_SECRET 일치 여부 확인
```

**vector 확장 오류**
```bash
# init-db.sql이 실행됐는지 확인
docker compose exec postgres psql -U docmonauto -d docmonauto -c "\dx"
# vector 확장이 없으면 수동 실행:
docker compose exec postgres psql -U docmonauto -d docmonauto \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```
