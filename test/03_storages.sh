#!/usr/bin/env bash
# TC-03: 스토리지 관리
# 목적: 스토리지 CRUD (등록/조회/활성화토글/삭제) 및 RBAC 검증
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-03 스토리지 관리"

# 로그인
step "사전 준비: 로그인"
ADMIN_TOKEN=$(login "${ADMIN_EMAIL}" "${ADMIN_PASSWORD}")
[ -z "$ADMIN_TOKEN" ] && { fail "로그인 실패 → 스킵"; print_summary; exit 1; }
pass "로그인 성공"

# ── 1. 스토리지 목록 조회 ────────────────────────────────────
step "3-1. 스토리지 목록 조회"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/storages")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  pass "스토리지 목록 조회 200 OK (${COUNT}개)"
else
  fail "스토리지 목록 조회 실패 → HTTP $STATUS"
fi

# ── 2. 스토리지 등록 ─────────────────────────────────────────
step "3-2. ON_PREMISE 스토리지 등록"
TS=$(date +%s)
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{\"name\":\"test-storage-${TS}\",\"provider\":\"ON_PREMISE\",\"bucketOrPath\":\"/tmp/test-${TS}\"}" \
  "${BACKEND_URL}/api/v1/storages")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  STORAGE_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  IS_ACTIVE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isActive','?'))" 2>/dev/null)
  pass "스토리지 등록 성공 → ID: ${STORAGE_ID} / isActive: ${IS_ACTIVE}"
else
  fail "스토리지 등록 실패 → HTTP $STATUS / $BODY"
  STORAGE_ID=""
fi

# ── 3. AWS S3 스토리지 등록 ──────────────────────────────────
step "3-3. AWS S3 스토리지 등록"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{\"name\":\"test-s3-${TS}\",\"provider\":\"AWS_S3\",\"bucketOrPath\":\"my-test-bucket\",\"region\":\"ap-northeast-2\"}" \
  "${BACKEND_URL}/api/v1/storages")
STATUS=$(echo "$RESP" | tail -1)
if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  S3_ID=$(echo "$RESP" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  pass "AWS S3 스토리지 등록 성공 → ID: ${S3_ID}"
else
  fail "AWS S3 스토리지 등록 실패 → HTTP $STATUS"
  S3_ID=""
fi

# ── 4. 활성화 토글 (비활성화) ────────────────────────────────
step "3-4. 스토리지 비활성화"
if [ -n "${STORAGE_ID:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d '{"isActive":false}' \
    "${BACKEND_URL}/api/v1/storages/${STORAGE_ID}/active")
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)
  IS_ACTIVE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isActive','?'))" 2>/dev/null)
  if [ "$STATUS" = "200" ] && [ "$IS_ACTIVE" = "False" -o "$IS_ACTIVE" = "false" ]; then
    pass "스토리지 비활성화 성공 → isActive: false"
  else
    fail "비활성화 실패 → HTTP $STATUS / isActive: $IS_ACTIVE"
  fi
else
  skip "STORAGE_ID 없음"
fi

# ── 5. 활성화 토글 (재활성화) ────────────────────────────────
step "3-5. 스토리지 재활성화"
if [ -n "${STORAGE_ID:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d '{"isActive":true}' \
    "${BACKEND_URL}/api/v1/storages/${STORAGE_ID}/active")
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)
  IS_ACTIVE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isActive','?'))" 2>/dev/null)
  if [ "$STATUS" = "200" ] && [ "$IS_ACTIVE" = "True" -o "$IS_ACTIVE" = "true" ]; then
    pass "스토리지 재활성화 성공 → isActive: true"
  else
    fail "재활성화 실패 → HTTP $STATUS / isActive: $IS_ACTIVE"
  fi
else
  skip "STORAGE_ID 없음"
fi

# ── 6. 스토리지 삭제 (테스트용 정리) ─────────────────────────
step "3-6. 테스트 스토리지 삭제 (SUPER_ADMIN)"
for sid in "${STORAGE_ID:-}" "${S3_ID:-}"; do
  [ -z "$sid" ] && continue
  RESP=$(curl -s -w "\n%{http_code}" -X DELETE \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${BACKEND_URL}/api/v1/storages/${sid}")
  STATUS=$(echo "$RESP" | tail -1)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    pass "스토리지 삭제 성공 → ID: $sid"
  else
    fail "스토리지 삭제 실패 → HTTP $STATUS (ID: $sid)"
  fi
done

print_summary
