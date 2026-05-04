# Frontend — Next.js 웹 UI

DocMonAuto의 웹 프론트엔드. 챗 인터페이스 + 관리자 대시보드.

---

## 기술 스택

| 항목 | 내용 |
|-----|-----|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript 5.x |
| 스타일 | Tailwind CSS 3.x |
| 서버 상태 | TanStack Query 5 |
| 클라이언트 상태 | Zustand |
| HTTP | Axios |
| 아이콘 | Lucide React |
| 마크다운 | react-markdown + remark-gfm |

---

## 페이지 구조

```
/                 → /chat (리다이렉트)
/login            → 이메일/비밀번호 로그인
/chat             → RAG 문서 질의응답 채팅
/admin            → 대시보드 (통계, 최근 작업/질의)
/admin/storages   → 스토리지 등록·활성화·삭제
/admin/policies   → 보안 정책 생성·수정·삭제
/admin/indexing   → 인덱싱 큐 통계 + 작업 목록 (10s 자동 갱신)
/admin/agents     → 에이전트 등록 + Ping 테스트
```

관리 페이지는 `ADMIN` / `SUPER_ADMIN` 역할만 사이드바에 표시됩니다.

---

## 전제 조건

- Node.js 22+
- NestJS 백엔드 실행 중 (`http://localhost:3001`)

---

## 개발 모드 (Development)

### 설치

```bash
cd frontend
npm install
```

### 환경변수

```bash
cp .env.local.example .env.local
# 필요 시 NEXT_PUBLIC_BACKEND_URL 수정
```

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 실행

```bash
npm run dev
# http://localhost:3000
```

### 기본 계정

| 이메일 | 비밀번호 | 역할 |
|-------|--------|-----|
| `admin@docmonauto.local` | `Admin1234!` | SUPER_ADMIN |
| `viewer@docmonauto.local` | `Viewer1234!` | VIEWER |

### 타입 체크 & 린트

```bash
npm run type-check   # TypeScript 오류 확인
npm run lint         # ESLint
```

---

## 프로덕션 모드 (Production)

### 빌드

```bash
npm run build
npm run start
```

### Docker로 실행

```bash
docker build -t docmonauto-frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_BACKEND_URL=http://backend:3001 \
  docmonauto-frontend
```

### Docker Compose (전체 스택)

```bash
cd ops
docker compose up -d
# 프론트엔드: http://localhost:3000
```

---

## 환경변수

| 변수 | 기본값 | 설명 |
|-----|-------|-----|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | NestJS 백엔드 URL |

---

## 인증 흐름

1. `/login` → `POST /api/v1/auth/login` → JWT 수신
2. JWT는 `localStorage`에 저장
3. Axios 인터셉터가 모든 요청에 `Authorization: Bearer <token>` 자동 첨부
4. 401 응답 시 자동 로그아웃 → `/login` 리다이렉트

---

## 주요 기능

### 채팅 (`/chat`)

- `POST /api/v1/query` 호출 (채널: `BROWSER`)
- 응답: Markdown 렌더링, 출처 문서 표시, LLM 제공자/레이턴시 표시
- 질의 이력 사이드패널 (`GET /api/v1/query/history`)
- Shift+Enter 줄바꿈, Enter 전송

### 관리자 대시보드 (`/admin`)

- 총 문서 수, 활성 스토리지, 대기 작업, 온라인 에이전트
- 최근 인덱싱 작업 + 최근 질의 목록
- 30초 자동 갱신

### 스토리지 (`/admin/storages`)

- 스토리지 목록 (제공자, 경로, 에이전트, 상태)
- 등록 모달 (이름, 제공자, 버킷/경로, 리전)
- 활성화/비활성화 토글
- 삭제 (확인 다이얼로그)

### 정책 (`/admin/policies`)

- 정책 카드 목록 (보안 등급, 관할권, 전략, 허용 LLM 태그)
- 생성/수정 모달 (다중 선택 토글 버튼)
- 삭제

### 인덱싱 모니터 (`/admin/indexing`)

- BullMQ 큐 통계 (대기/처리중/완료/실패/지연)
- 작업 목록 (문서명, 전략, 우선순위, 상태, 소요시간)
- 10초 자동 갱신

### 에이전트 (`/admin/agents`)

- 에이전트 목록 (엔드포인트, 상태, 마지막 확인)
- 등록 모달
- Ping 테스트 (레이턴시 표시)
