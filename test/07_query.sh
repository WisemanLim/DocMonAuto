#!/usr/bin/env bash
# TC-07: RAG 질의응답 엔드투엔드
# 목적: 문서 인덱싱 → Backend RAG 파이프라인 → LLM 응답 전체 흐름 확인
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-07 RAG 질의응답 엔드투엔드"

ensure_watch_dir

ADMIN_TOKEN=$(login "${ADMIN_EMAIL}" "${ADMIN_PASSWORD}")
[ -z "$ADMIN_TOKEN" ] && { fail "로그인 실패"; print_summary; exit 1; }
pass "로그인 성공"

# ── 사전 준비: 질의할 문서 인덱싱 ───────────────────────────
step "사전 준비: 질의 대상 문서 인덱싱"
TS=$(date +%s)
DOC_ID="query-test-doc-${TS}"
TEST_FILE="${WATCH_PATH}/query-test-${TS}.txt"

cat > "${TEST_FILE}" << 'EOF'
DocMonAuto는 분산 문서 스토리지를 모니터링하는 RAG 플랫폼입니다.
주요 특징:
1. 문서 원본 이동 없이 로컬에서 인덱싱 수행
2. BGE-M3 다국어 임베딩 모델 사용
3. 벡터 검색과 전문 검색의 하이브리드 방식 지원
4. 보안 등급(OPEN/INTERNAL/CONFIDENTIAL/SECRET)에 따른 정책 적용
5. OpenAI, Google Gemini, Ollama 등 다중 LLM 지원

시스템 구성요소:
- Python FastAPI 에이전트: 로컬 인덱싱 담당
- NestJS 백엔드: 정책 엔진, 큐 관리, LLM 오케스트레이션
- PostgreSQL + pgvector: 벡터 및 FTS 인덱스 저장
- BullMQ + Valkey: 우선순위 인덱싱 큐
EOF

RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{\"documentId\":\"${DOC_ID}\",\"externalId\":\"${TEST_FILE}\",\"storageId\":\"${STORAGE_ID}\",\"eventType\":\"CREATE\",\"strategy\":\"BOTH\"}" \
  "${AGENT_URL}/index")
STATUS=$(echo "$RESP" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  pass "문서 인덱싱 완료: ${DOC_ID}"
else
  fail "문서 인덱싱 실패 → HTTP $STATUS"
  print_summary; exit 1
fi

info "임베딩 대기 (5초)..."
sleep 5

# ── 1. BROWSER 채널 질의 ─────────────────────────────────────
step "7-1. BROWSER 채널 RAG 질의"
START_MS=$(python3 -c "import time; print(int(time.time()*1000))")
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"query":"DocMonAuto의 주요 특징은 무엇인가요?","channel":"BROWSER"}' \
  "${BACKEND_URL}/api/v1/query")
END_MS=$(python3 -c "import time; print(int(time.time()*1000))")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  ANSWER=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('answer','')[:100])" 2>/dev/null)
  LLM=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('llmProvider','?'))" 2>/dev/null)
  LATENCY=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('latencyMs','?'))" 2>/dev/null)
  ELAPSED=$(( END_MS - START_MS ))
  pass "RAG 질의 성공 → LLM: ${LLM} / 레이턴시: ${LATENCY}ms / 전체: ${ELAPSED}ms"
  info "답변(앞 100자): ${ANSWER}..."
else
  fail "RAG 질의 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 2. 질의 이력 확인 ────────────────────────────────────────
step "7-2. 질의 이력 조회"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/query/history")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  pass "질의 이력 조회 성공 → ${COUNT}개 이력"
else
  fail "질의 이력 조회 실패 → HTTP $STATUS"
fi

# ── 3. API 채널 질의 ─────────────────────────────────────────
step "7-3. API 채널 RAG 질의"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"query":"시스템 구성요소를 나열해주세요.","channel":"API"}' \
  "${BACKEND_URL}/api/v1/query")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  ANSWER=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('answer','')[:80])" 2>/dev/null)
  pass "API 채널 질의 성공"
  info "답변(앞 80자): ${ANSWER}..."
else
  fail "API 채널 질의 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 4. 빈 쿼리 처리 ─────────────────────────────────────────
step "7-4. 빈 쿼리 유효성 검사"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"query":"","channel":"BROWSER"}' \
  "${BACKEND_URL}/api/v1/query")
STATUS=$(echo "$RESP" | tail -1)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "422" ]; then
  pass "빈 쿼리 → HTTP $STATUS (유효성 검사 통과)"
else
  fail "빈 쿼리가 허용됨 → HTTP $STATUS"
fi

# ── 5. 미인증 질의 거부 ──────────────────────────────────────
step "7-5. 미인증 질의 거부"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"테스트","channel":"BROWSER"}' \
  "${BACKEND_URL}/api/v1/query")
STATUS=$(echo "$RESP" | tail -1)
if [ "$STATUS" = "401" ]; then
  pass "미인증 질의 → HTTP 401"
else
  fail "미인증 질의가 허용됨 → HTTP $STATUS"
fi

# ── 정리 ────────────────────────────────────────────────────
step "사후 정리"
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{\"documentId\":\"${DOC_ID}\"}" \
  "${AGENT_URL}/index/delete" > /dev/null 2>&1
rm -f "${TEST_FILE}" 2>/dev/null
info "정리 완료"

print_summary
