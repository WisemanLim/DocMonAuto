#!/usr/bin/env bash
# TC-05: 문서 인덱싱 파이프라인
# 목적: 파일 생성 이벤트 → 에이전트 직접 인덱싱 → 큐 상태 확인 → 인덱스 삭제
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-05 문서 인덱싱 파이프라인"

ensure_watch_dir

ADMIN_TOKEN=$(login "${ADMIN_EMAIL}" "${ADMIN_PASSWORD}")
[ -z "$ADMIN_TOKEN" ] && { fail "로그인 실패"; print_summary; exit 1; }
pass "로그인 성공"

# ── 1. 텍스트 파일 인덱싱 (에이전트 직접 호출) ───────────────
step "5-1. TXT 파일 생성 및 인덱싱 요청"
TS=$(date +%s)
DOC_ID="test-doc-txt-${TS}"
TEST_FILE="${WATCH_PATH}/test-${TS}.txt"

cat > "${TEST_FILE}" << 'EOF'
DocMonAuto 시스템 테스트 문서입니다.
이 문서는 분산 RAG 플랫폼의 인덱싱 기능을 테스트하기 위해 생성되었습니다.
벡터 임베딩과 전문 검색(FTS) 이중 인덱싱 전략을 사용합니다.
BGE-M3 모델을 사용하여 다국어 문서를 처리합니다.
정책 엔진은 보안 등급에 따라 인덱싱 전략과 LLM을 선택합니다.
EOF

info "생성 파일: ${TEST_FILE}"

RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{
    \"documentId\": \"${DOC_ID}\",
    \"externalId\": \"${TEST_FILE}\",
    \"storageId\": \"${STORAGE_ID}\",
    \"eventType\": \"CREATE\",
    \"strategy\": \"BOTH\"
  }" \
  "${AGENT_URL}/index")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  pass "TXT 인덱싱 요청 성공 → HTTP $STATUS"
  info "응답: $BODY"
else
  fail "TXT 인덱싱 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 2. VECTORLESS_ONLY 전략 인덱싱 ───────────────────────────
step "5-2. VECTORLESS_ONLY 전략으로 인덱싱"
DOC_ID2="test-doc-fts-${TS}"
TEST_FILE2="${WATCH_PATH}/test-fts-${TS}.txt"

echo "FTS 전용 인덱싱 테스트 문서. 키워드: 보안정책 데이터인덱싱 검색최적화" > "${TEST_FILE2}"

RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{
    \"documentId\": \"${DOC_ID2}\",
    \"externalId\": \"${TEST_FILE2}\",
    \"storageId\": \"${STORAGE_ID}\",
    \"eventType\": \"CREATE\",
    \"strategy\": \"VECTORLESS_ONLY\"
  }" \
  "${AGENT_URL}/index")
STATUS=$(echo "$RESP" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  pass "VECTORLESS_ONLY 인덱싱 성공"
else
  fail "VECTORLESS_ONLY 인덱싱 실패 → HTTP $STATUS"
fi

# ── 3. Backend 이벤트 → 큐 등록 ──────────────────────────────
step "5-3. Backend 내부 이벤트 API로 큐 등록"
DOC_ID3="test-doc-backend-${TS}"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{
    \"eventType\": \"CREATE\",
    \"externalId\": \"${WATCH_PATH}/test-backend-${TS}.txt\",
    \"storageId\": \"${STORAGE_ID}\",
    \"contentType\": \"text/plain\",
    \"sizeBytes\": 1024,
    \"securityLevel\": \"INTERNAL\"
  }" \
  "${BACKEND_URL}/api/v1/internal/events/storage")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  pass "Backend 이벤트 수신 성공 → HTTP $STATUS"
  info "응답: $BODY"
else
  fail "Backend 이벤트 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 4. 인덱싱 큐 통계 확인 ───────────────────────────────────
step "5-4. 인덱싱 큐 통계 확인"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/indexing/stats")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  WAITING=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('waiting',0))" 2>/dev/null)
  COMPLETED=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('completed',0))" 2>/dev/null)
  pass "큐 통계 조회 성공 → 대기: ${WAITING}, 완료: ${COMPLETED}"
else
  fail "큐 통계 조회 실패 → HTTP $STATUS"
fi

# ── 5. 인덱싱 작업 목록 확인 ─────────────────────────────────
step "5-5. 인덱싱 작업 목록 확인"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/indexing/jobs")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  pass "작업 목록 조회 성공 → ${COUNT}개 작업"
else
  fail "작업 목록 조회 실패 → HTTP $STATUS"
fi

# ── 6. 인덱스 삭제 ───────────────────────────────────────────
step "5-6. 에이전트 인덱스 삭제"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{\"documentId\": \"${DOC_ID}\"}" \
  "${AGENT_URL}/index/delete")
STATUS=$(echo "$RESP" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
  pass "인덱스 삭제 성공 → ID: ${DOC_ID}"
else
  fail "인덱스 삭제 실패 → HTTP $STATUS"
fi

RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{\"documentId\": \"${DOC_ID2}\"}" \
  "${AGENT_URL}/index/delete")
STATUS=$(echo "$RESP" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
  pass "인덱스 삭제 성공 → ID: ${DOC_ID2}"
else
  fail "인덱스 삭제 실패 → HTTP $STATUS"
fi

# 테스트 파일 정리
rm -f "${TEST_FILE}" "${TEST_FILE2}" 2>/dev/null
info "임시 파일 삭제 완료"

print_summary
