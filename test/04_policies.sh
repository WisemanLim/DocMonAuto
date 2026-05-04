#!/usr/bin/env bash
# TC-04: 정책 관리 및 평가
# 목적: 보안 정책 CRUD 및 우선순위 기반 정책 평가 동작 확인
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-04 정책 관리"

# 로그인
ADMIN_TOKEN=$(login "${ADMIN_EMAIL}" "${ADMIN_PASSWORD}")
[ -z "$ADMIN_TOKEN" ] && { fail "로그인 실패"; print_summary; exit 1; }
pass "로그인 성공"

# ── 1. 기본 정책 목록 조회 ───────────────────────────────────
step "4-1. 정책 목록 조회"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/policies")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  pass "정책 목록 조회 200 OK (${COUNT}개)"
else
  fail "정책 목록 조회 실패 → HTTP $STATUS"
fi

# ── 2. SECRET 정책 생성 ──────────────────────────────────────
step "4-2. SECRET 등급 정책 생성"
TS=$(date +%s)
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{
    \"name\": \"test-secret-policy-${TS}\",
    \"priority\": 100,
    \"securityLevels\": [\"SECRET\"],
    \"jurisdictions\": [\"KR\"],
    \"strategy\": \"VECTORLESS_ONLY\",
    \"allowedLlms\": [\"ollama\"],
    \"isActive\": true
  }" \
  "${BACKEND_URL}/api/v1/policies")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  POL_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  pass "SECRET 정책 생성 성공 → ID: ${POL_ID}"
else
  fail "정책 생성 실패 → HTTP $STATUS / $BODY"
  POL_ID=""
fi

# ── 3. CONFIDENTIAL 정책 생성 ────────────────────────────────
step "4-3. CONFIDENTIAL 등급 정책 생성"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{
    \"name\": \"test-conf-policy-${TS}\",
    \"priority\": 80,
    \"securityLevels\": [\"CONFIDENTIAL\"],
    \"jurisdictions\": [\"KR\", \"GLOBAL\"],
    \"strategy\": \"BOTH\",
    \"allowedLlms\": [\"ollama\", \"openai\"],
    \"isActive\": true
  }" \
  "${BACKEND_URL}/api/v1/policies")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  POL_CONF_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  pass "CONFIDENTIAL 정책 생성 성공 → ID: ${POL_CONF_ID}"
else
  fail "CONFIDENTIAL 정책 생성 실패 → HTTP $STATUS"
  POL_CONF_ID=""
fi

# ── 4. 정책 수정 ─────────────────────────────────────────────
step "4-4. 정책 수정 (allowedLlms 추가)"
if [ -n "${POL_ID:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X PUT \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d "{
      \"name\": \"test-secret-policy-${TS}-updated\",
      \"priority\": 100,
      \"securityLevels\": [\"SECRET\"],
      \"jurisdictions\": [\"KR\"],
      \"strategy\": \"VECTORLESS_ONLY\",
      \"allowedLlms\": [\"ollama\", \"aws-bedrock\"],
      \"isActive\": true
    }" \
    "${BACKEND_URL}/api/v1/policies/${POL_ID}")
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)
  if [ "$STATUS" = "200" ]; then
    LLMS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('allowedLlms',[]))" 2>/dev/null)
    pass "정책 수정 성공 → allowedLlms: $LLMS"
  else
    fail "정책 수정 실패 → HTTP $STATUS"
  fi
else
  skip "POL_ID 없음"
fi

# ── 5. 비활성 정책 생성 ──────────────────────────────────────
step "4-5. 비활성 정책 생성 확인"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{
    \"name\": \"inactive-policy-${TS}\",
    \"priority\": 10,
    \"securityLevels\": [\"OPEN\"],
    \"jurisdictions\": [\"GLOBAL\"],
    \"strategy\": \"BOTH\",
    \"allowedLlms\": [],
    \"isActive\": false
  }" \
  "${BACKEND_URL}/api/v1/policies")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  INACTIVE_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  IS_ACTIVE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isActive'))" 2>/dev/null)
  if [ "$IS_ACTIVE" = "False" ]; then
    pass "비활성 정책 생성 성공 → isActive: false"
  else
    fail "isActive가 false가 아님 → $IS_ACTIVE"
  fi
else
  fail "비활성 정책 생성 실패 → HTTP $STATUS"
  INACTIVE_ID=""
fi

# ── 6. 정책 삭제 (테스트 정리) ───────────────────────────────
step "4-6. 테스트 정책 삭제"
for pid in "${POL_ID:-}" "${POL_CONF_ID:-}" "${INACTIVE_ID:-}"; do
  [ -z "$pid" ] && continue
  RESP=$(curl -s -w "\n%{http_code}" -X DELETE \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${BACKEND_URL}/api/v1/policies/${pid}")
  STATUS=$(echo "$RESP" | tail -1)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    pass "정책 삭제 성공 → ID: $pid"
  else
    fail "정책 삭제 실패 → HTTP $STATUS (ID: $pid)"
  fi
done

print_summary
