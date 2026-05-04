# 오픈소스 조사 및 비교

**프로젝트**: DocMonAuto  
**작성일**: 2026-04-30  
**기준**: PRD.md 요구사항 기반, 상업적 사용 가능성 우선 검토

> **라이선스 위험도 기준**
> - ✅ 안전: MIT, Apache 2.0, BSD, PostgreSQL License
> - ⚠️ 검토 필요: LGPL, MPL 2.0, EPL
> - ❌ 주의: GPL, AGPL, SSPL (상업 서비스 배포 시 전체 소스 공개 의무)

---

## 1. 문서 파싱 (Document Parsing)

지원 형식: PDF, DOCX, XLSX, PPTX, TXT, MD, HTML (PRD §4)

| 라이브러리 | 언어 | 라이선스 | 지원 형식 | 장점 | 단점 | 권장도 |
|----------|-----|---------|---------|-----|-----|-------|
| **Docling** (IBM) | Python | MIT | PDF, DOCX, XLSX, PPTX, HTML, MD | 레이아웃 보존, 표/수식 구조화, LlamaIndex/LangChain 통합 | 무거운 모델 의존 | ⭐⭐⭐⭐⭐ |
| **Unstructured** | Python | Apache 2.0 | PDF, DOCX, XLSX, PPTX, HTML, EML, ... | 20+ 형식 통합, 파티셔닝 전략 다양 | 고급 기능 일부 상용 | ⭐⭐⭐⭐ |
| **PyMuPDF (fitz)** | Python | AGPL 3.0 / 상용 | PDF, XPS, EPUB | 빠른 속도, 정확한 텍스트 추출 | ❌ AGPL — 상업 서비스 시 라이선스 구매 필요 | ⚠️ |
| **pdfplumber** | Python | MIT | PDF | 표 추출 강점 | PDF 전용 | ⭐⭐⭐ |
| **pypdf** | Python | BSD | PDF | 경량, 순수 Python | 복잡한 레이아웃 취약 | ⭐⭐ |
| **python-docx** | Python | MIT | DOCX | 표준 DOCX 처리 | DOCX 전용 | ⭐⭐⭐ (단독 미사용) |
| **Apache Tika** | Java/Python | Apache 2.0 | 1500+ 형식 | 형식 범위 최대 | JVM 의존, 속도 느림 | ⭐⭐ |

**권장**: **Docling** (MIT, 주력) + **Unstructured** (Apache 2.0, fallback)  
**주의**: PyMuPDF는 AGPL — 상업 배포 시 라이선스 구매 또는 대체 필수

---

## 2. 텍스트 청킹 (Chunking)

| 라이브러리 | 라이선스 | 전략 | 장점 | 단점 | 권장도 |
|----------|---------|-----|-----|-----|-------|
| **LlamaIndex NodeParser** | MIT | Semantic, Sentence, Token, Hierarchical | 전략 다양, LlamaIndex 생태계 통합 | LlamaIndex 의존 | ⭐⭐⭐⭐⭐ |
| **LangChain TextSplitters** | MIT | Character, Token, Recursive, Markdown | 유연, 커스터마이징 쉬움 | LangChain 의존 | ⭐⭐⭐⭐ |
| **chonkie** | MIT | Semantic, Token, Sentence | 경량, 독립 라이브러리 | 생태계 작음 | ⭐⭐⭐ |
| **semchunk** | MIT | Semantic | 의미 단위 청킹 특화 | 기능 제한적 | ⭐⭐ |

**권장**: **LlamaIndex NodeParser** (MIT) — Vectorless 인덱서와 통합 용이

---

## 3. 임베딩 모델 (Embedding Models)

| 모델 | 라이선스 | 차원 | 다국어 | 온프레 배포 | 권장도 |
|-----|---------|-----|------|-----------|-------|
| **BGE-M3** (BAAI) | MIT | 1024 | ✅ (100+ 언어) | ✅ | ⭐⭐⭐⭐⭐ |
| **text-embedding-3-small** (OpenAI) | 상용 API | 1536 | ✅ | ❌ | ⭐⭐⭐⭐ (클라우드 전용) |
| **text-embedding-3-large** (OpenAI) | 상용 API | 3072 | ✅ | ❌ | ⭐⭐⭐ (비용 높음) |
| **multilingual-e5-large** (Microsoft) | MIT | 1024 | ✅ | ✅ | ⭐⭐⭐⭐ |
| **KoSimCSE-roberta** | MIT | 768 | 한국어 특화 | ✅ | ⭐⭐⭐ (한국어 전용) |
| **sentence-transformers** | Apache 2.0 | 가변 | 모델 의존 | ✅ | ⭐⭐⭐⭐ (허브) |

**권장 전략**:
- 기본: **BGE-M3** (MIT, 온프레 + 다국어, 한국어 포함)
- 클라우드 OPEN 문서: **text-embedding-3-small** (비용 효율)
- SECRET/CONFIDENTIAL: **BGE-M3 온프레 전용**

---

## 4. 벡터 데이터베이스 (Vector DB)

| 솔루션 | 라이선스 | 배포 방식 | PostgreSQL 통합 | 한국어 | 성능 | 권장도 |
|-------|---------|---------|---------------|-------|-----|-------|
| **pgvector** | MIT | PostgreSQL 확장 | ✅ 네이티브 | ✅ | 중-고 (HNSW) | ⭐⭐⭐⭐⭐ |
| **Qdrant** | Apache 2.0 | 독립 서버/클라우드 | ❌ | ✅ | 고 | ⭐⭐⭐⭐ |
| **Milvus** | Apache 2.0 | 독립 서버/클러스터 | ❌ | ✅ | 매우 고 | ⭐⭐⭐ (운영 복잡) |
| **Chroma** | Apache 2.0 | 임베디드/서버 | ❌ | ✅ | 중 | ⭐⭐⭐ (개발/소규모) |
| **Weaviate** | BSD 3-Clause | 독립 서버/클라우드 | ❌ | ✅ | 고 | ⭐⭐⭐ |
| **FAISS** (Meta) | MIT | 라이브러리 | ❌ | ✅ | 매우 고 (메모리) | ⭐⭐ (운영 어려움) |

**권장**: **pgvector** (MIT)  
- PostgreSQL 단일 스택으로 운영 단순화 (PRD §2.2 방향과 일치)
- HNSW 인덱스로 대규모 벡터 검색 성능 확보
- 추후 규모 증가 시 Qdrant 도입 검토

---

## 5. RAG 프레임워크

| 프레임워크 | 라이선스 | 언어 | Vectorless 지원 | 멀티소스 | 권장도 |
|----------|---------|-----|--------------|--------|-------|
| **LlamaIndex** | MIT | Python | ✅ (PageIndex 유사) | ✅ | ⭐⭐⭐⭐⭐ |
| **LangChain** | MIT | Python/JS | ⚠️ (제한적) | ✅ | ⭐⭐⭐⭐ |
| **Haystack** (deepset) | Apache 2.0 | Python | ⚠️ | ✅ | ⭐⭐⭐ |
| **DSPy** (Stanford) | MIT | Python | ❌ | ❌ | ⭐⭐ (최적화 특화) |
| **RAGFlow** | Apache 2.0 | Python | ⚠️ | ✅ | ⭐⭐⭐ (완성 솔루션) |

**권장**: **LlamaIndex** (MIT)  
- `VectorStoreIndex`: Vector 인덱싱
- `SummaryIndex` / `KeywordTableIndex`: Vectorless 인덱싱 구현 기반
- `RouterQueryEngine`: 멀티 인덱스 라우팅 (PRD IR-03과 직접 대응)
- `SubQuestionQueryEngine`: 분산 질의 (PRD IR-04)

---

## 6. Vectorless 인덱싱 구현

PRD IN-02: 페이지/섹션 단위 구조 인덱스 (임베딩 없이 빠른 서비스 반영)

| 방식 | 기반 | 라이선스 | 설명 | 권장도 |
|-----|-----|---------|-----|-------|
| **LlamaIndex SummaryIndex** | LlamaIndex | MIT | LLM 기반 청크 요약 후 검색 | ⭐⭐⭐⭐⭐ |
| **BM25 (rank_bm25)** | rank_bm25 | Apache 2.0 | 전통 키워드 역색인, 임베딩 불필요 | ⭐⭐⭐⭐ |
| **Elasticsearch / OpenSearch** | Apache 2.0 | 전문 검색 엔진 | BM25 기반, 페이지 단위 인덱싱 | ⭐⭐⭐ (운영 부담) |
| **Tantivy** | MIT | Rust | 경량 전문 검색, BM25 | ⭐⭐⭐ |
| **PostgreSQL FTS** | PostgreSQL Lic. | 내장 전문 검색 | 단일 스택 유지, tsvector | ⭐⭐⭐⭐ |

**권장**: **PostgreSQL FTS** (tsvector/tsquery) + **BM25 (rank_bm25)**  
- PostgreSQL 스택 유지 → 운영 단순화
- Vectorless 즉시 서비스 → Phase 1 빠른 구현 가능
- LlamaIndex SummaryIndex는 Phase 2에서 LLM 기반 정교화

---

## 7. 멀티 LLM 통합 계층

| 솔루션 | 라이선스 | 지원 LLM | 스트리밍 | 온프레 | 권장도 |
|-------|---------|---------|--------|-------|-------|
| **LiteLLM** | MIT | 100+ (OpenAI, Google, AWS, Ollama...) | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **LangChain LLMs** | MIT | 50+ | ✅ | ✅ | ⭐⭐⭐⭐ |
| **LlamaIndex LLMs** | MIT | 30+ | ✅ | ✅ | ⭐⭐⭐⭐ |
| **OpenAI SDK** | MIT | OpenAI 전용 | ✅ | ❌ | ⭐⭐ (단독 사용) |

**권장**: **LiteLLM** (MIT)  
- 단일 OpenAI 호환 인터페이스로 OpenAI/Google/AWS Bedrock/Ollama 통합
- `litellm.completion()` → 모델만 바꾸면 동일 코드 동작
- PRD LO-01~04 모두 커버
- NestJS 백엔드에서 HTTP 프록시 또는 Python 사이드카로 운용

---

## 8. 온프레미스 LLM 서빙

| 솔루션 | 라이선스 | 지원 모델 | API 호환 | GPU 필요 | 권장도 |
|-------|---------|---------|--------|---------|-------|
| **Ollama** | MIT | Llama, Mistral, Qwen, Gemma... | OpenAI API ✅ | 선택적 | ⭐⭐⭐⭐⭐ |
| **vLLM** | Apache 2.0 | HuggingFace 모델 | OpenAI API ✅ | 필수 | ⭐⭐⭐⭐ (고성능) |
| **llama.cpp** | MIT | GGUF 형식 | OpenAI API ✅ | CPU 가능 | ⭐⭐⭐ (저사양 환경) |
| **LocalAI** | MIT | 다수 | OpenAI API ✅ | 선택적 | ⭐⭐⭐ |
| **LM Studio** | 상용 (개인 무료) | 다수 | OpenAI API ✅ | 선택적 | ❌ (상업 제한) |

**권장**:
- 개발/소규모: **Ollama** (MIT, 설치 간편, CPU 가능)
- 프로덕션 고성능: **vLLM** (Apache 2.0, GPU, 높은 처리량)

---

## 9. 이벤트 처리 & 메시지 큐

| 솔루션 | 라이선스 | 언어 | 우선순위 큐 | 재시도 | 권장도 |
|-------|---------|-----|-----------|-------|-------|
| **BullMQ** | MIT | Node.js (Redis 기반) | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **Redis Streams** | RSALv2 (Redis 7.4+) / BSD (Valkey) | 다국어 | ⚠️ (직접 구현) | ⚠️ | ⭐⭐⭐ |
| **Celery** | BSD | Python | ✅ | ✅ | ⭐⭐⭐⭐ (Python 에이전트 친화) |
| **RQ (Redis Queue)** | BSD | Python | ⚠️ | ✅ | ⭐⭐⭐ |
| **Apache Kafka** | Apache 2.0 | 다국어 | ⚠️ | ✅ | ⭐⭐ (운영 복잡, 소규모 과도) |

> **Redis 라이선스 주의**: Redis 7.4부터 RSALv2+SSPL 이중 라이선스 변경.  
> **Valkey** (Linux Foundation fork, BSD-3): 완전 오픈소스 대체재.

**권장**:
- NestJS 백엔드: **BullMQ** (MIT) + **Valkey** (BSD-3, Redis 대체)
- Python 에이전트: **Celery** (BSD) + **Valkey**
- 우선순위 큐: BullMQ 기본 지원 (`priority` 옵션)

---

## 10. 온프레미스 파일시스템 감시 (이벤트 에이전트)

| 라이브러리 | 언어 | 라이선스 | 지원 OS | 권장도 |
|----------|-----|---------|--------|-------|
| **watchdog** | Python | Apache 2.0 | Linux/macOS/Windows | ⭐⭐⭐⭐⭐ |
| **chokidar** | Node.js | MIT | Linux/macOS/Windows | ⭐⭐⭐⭐ |
| **inotify-tools** | GPL 2.0 | Linux 전용 | Linux only | ⚠️ GPL |
| **FSEvents** | macOS 시스템 API | — | macOS only | ⭐⭐ (OS 제한) |

**권장**: **watchdog** (Apache 2.0) — Python 에이전트와 통합, 크로스플랫폼

---

## 11. 클라우드 스토리지 SDK

| SDK | 라이선스 | 비고 |
|----|---------|-----|
| **boto3** (AWS) | Apache 2.0 | S3, SQS, SNS, EventBridge |
| **google-cloud-storage** | Apache 2.0 | GCS, Pub/Sub |
| **azure-storage-blob** | MIT | Azure Blob Storage |
| **azure-eventgrid** | MIT | Azure Event Grid |
| **ncloud-sdk** (Naver) | Apache 2.0 | Naver Cloud Object Storage |

모두 ✅ 안전 라이선스.

---

## 12. MCP (Model Context Protocol)

| 솔루션 | 라이선스 | 언어 | 권장도 |
|-------|---------|-----|-------|
| **@modelcontextprotocol/sdk** (Anthropic) | MIT | TypeScript/Python | ⭐⭐⭐⭐⭐ |
| **FastMCP** | MIT | Python | ⭐⭐⭐⭐ (경량 Python 구현) |

**권장**: NestJS에서 **@modelcontextprotocol/sdk** (MIT) 직접 통합

---

## 13. 인증 & 접근 제어

| 솔루션 | 라이선스 | 기능 | 권장도 |
|-------|---------|-----|-------|
| **@nestjs/jwt** + **passport** | MIT | JWT 발급/검증, Strategy 패턴 | ⭐⭐⭐⭐⭐ |
| **Casbin** | Apache 2.0 | RBAC/ABAC 정책 엔진 | ⭐⭐⭐⭐⭐ |
| **Keycloak** | Apache 2.0 | SSO, OIDC, LDAP 연동 | ⭐⭐⭐ (Phase 2+) |
| **casl** | MIT | Node.js 권한 라이브러리 | ⭐⭐⭐⭐ |

**권장**:
- JWT: **@nestjs/jwt + passport** (MIT)
- RBAC 정책: **Casbin** (Apache 2.0) — PRD PE-01~02 정책 엔진과 연계 가능

---

## 14. 백엔드 프레임워크

| 솔루션 | 라이선스 | 언어 | 권장도 |
|-------|---------|-----|-------|
| **NestJS** | MIT | TypeScript | ⭐⭐⭐⭐⭐ (PRD 확정) |
| **FastAPI** | MIT | Python | ⭐⭐⭐⭐⭐ (에이전트용) |
| **Fastify** | MIT | TypeScript | ⭐⭐⭐ (NestJS 내부 어댑터) |

**확정**: NestJS (MIT) + FastAPI (MIT, 스토리지 에이전트)

---

## 15. 프론트엔드

| 솔루션 | 라이선스 | 용도 | 권장도 |
|-------|---------|-----|-------|
| **Next.js** | MIT | 웹 앱 (PRD 확정) | ⭐⭐⭐⭐⭐ |
| **shadcn/ui** | MIT | UI 컴포넌트 | ⭐⭐⭐⭐⭐ |
| **Tailwind CSS** | MIT | 스타일링 | ⭐⭐⭐⭐⭐ |
| **Vercel AI SDK** | Apache 2.0 | 스트리밍 챗 UI | ⭐⭐⭐⭐⭐ |
| **TanStack Query** | MIT | 서버 상태 관리 | ⭐⭐⭐⭐ |
| **Zustand** | MIT | 클라이언트 상태 | ⭐⭐⭐⭐ |
| **React Hook Form + Zod** | MIT | 폼 + 유효성 | ⭐⭐⭐⭐ |
| **Recharts** | MIT | 대시보드 차트 | ⭐⭐⭐⭐ |

---

## 16. ORM & 마이그레이션

| 솔루션 | 라이선스 | 언어 | pgvector 지원 | 권장도 |
|-------|---------|-----|-------------|-------|
| **Prisma** | Apache 2.0 | TypeScript | ✅ (prisma-client-extensions) | ⭐⭐⭐⭐⭐ |
| **TypeORM** | MIT | TypeScript | ✅ (수동) | ⭐⭐⭐⭐ |
| **Drizzle ORM** | MIT | TypeScript | ✅ | ⭐⭐⭐⭐ |
| **Alembic** | MIT | Python | ✅ | ⭐⭐⭐⭐ (Python 에이전트) |
| **Flyway** | Apache 2.0 | Java/SQL | — | ⭐⭐⭐ |

**권장**: **Prisma** (Apache 2.0) — NestJS 통합 최적, pgvector 지원, 타입 안전

---

## 17. 모니터링 & 로깅

| 솔루션 | 라이선스 | 용도 | 권장도 |
|-------|---------|-----|-------|
| **Prometheus** | Apache 2.0 | 메트릭 수집 | ⭐⭐⭐⭐⭐ |
| **Grafana** | AGPL 3.0 | 시각화 대시보드 | ⭐⭐⭐⭐ ⚠️ 내부 사용 OK |
| **OpenTelemetry** | Apache 2.0 | 분산 추적, 메트릭 | ⭐⭐⭐⭐⭐ |
| **Pino** | MIT | NestJS 고성능 로거 | ⭐⭐⭐⭐⭐ |
| **Loki** (Grafana) | AGPL 3.0 | 로그 집계 | ⭐⭐⭐⭐ ⚠️ 내부 사용 OK |

> **Grafana AGPL 주의**: 대외 SaaS로 Grafana 자체를 서비스하면 AGPL 적용. 내부 모니터링 도구로 사용하면 문제없음.

---

## 18. Ops / 컨테이너

| 솔루션 | 라이선스 | 용도 | 권장도 |
|-------|---------|-----|-------|
| **Docker** | Apache 2.0 (CE) | 컨테이너 런타임 | ⭐⭐⭐⭐⭐ |
| **Docker Compose** | Apache 2.0 | 로컬 개발 오케스트레이션 | ⭐⭐⭐⭐⭐ |
| **Traefik** | MIT | 리버스 프록시 / 라우팅 | ⭐⭐⭐⭐ |
| **Nginx** | BSD | 리버스 프록시 | ⭐⭐⭐⭐ |

---

## 최종 추천 스택 요약

| 영역 | 선택 | 라이선스 |
|-----|-----|---------|
| 문서 파싱 | Docling + Unstructured (fallback) | MIT / Apache 2.0 |
| 청킹 | LlamaIndex NodeParser | MIT |
| 임베딩 모델 | BGE-M3 (온프레) + OpenAI (클라우드) | MIT / 상용 |
| Vector DB | pgvector | MIT |
| Vectorless 인덱스 | PostgreSQL FTS + BM25 | PostgreSQL Lic. / Apache 2.0 |
| RAG 프레임워크 | LlamaIndex | MIT |
| 멀티 LLM | LiteLLM | MIT |
| 온프레 LLM 서빙 | Ollama (개발) / vLLM (프로덕션) | MIT / Apache 2.0 |
| 메시지 큐 | BullMQ + Valkey | MIT / BSD-3 |
| 파일시스템 감시 | watchdog | Apache 2.0 |
| MCP | @modelcontextprotocol/sdk | MIT |
| 인증 | @nestjs/jwt + Casbin | MIT / Apache 2.0 |
| 백엔드 | NestJS + FastAPI (에이전트) | MIT |
| ORM | Prisma | Apache 2.0 |
| 프론트엔드 | Next.js + shadcn/ui + Vercel AI SDK | MIT / Apache 2.0 |
| 모니터링 | Prometheus + OpenTelemetry + Pino | Apache 2.0 / MIT |
| 컨테이너 | Docker + Docker Compose | Apache 2.0 |

### 라이선스 위험 항목 정리

| 라이브러리 | 라이선스 | 위험 | 대안 |
|----------|---------|-----|-----|
| PyMuPDF | AGPL 3.0 | 상업 배포 시 소스 공개 의무 | Docling / pdfplumber |
| Redis 7.4+ | RSALv2+SSPL | 클라우드 서비스 배포 제한 | **Valkey** (BSD-3) |
| Grafana | AGPL 3.0 | 대외 서비스화 시 소스 공개 의무 | 내부 사용 시 OK |
| inotify-tools | GPL 2.0 | 링크 시 GPL 전파 | watchdog (Apache 2.0) |

---

*본 문서는 2026-04-30 기준 조사 결과이며, 각 라이브러리의 라이선스 변경 여부를 최종 채택 전 재확인 바랍니다.*
