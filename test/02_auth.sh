#!/usr/bin/env bash
# TC-02: 인증 (Authentication)
# 목적: JWT 로그인, 토큰 유효성, 인가 실패 케이스 확인
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-02 인증"

# ── 1. 유효한 로그인 ─────────────────────────────────────────
step "2-1. SUPER_ADMIN 로그인"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  "${BACKEND_URL}/api/v1/auth/login")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  ADMIN_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
  if [ -n "$ADMIN_TOKEN" ]; then
    pass "SUPER_ADMIN 로그인 성공 → accessToken 수신"
    info "Token 앞 40자: ${ADMIN_TOKEN:0:40}..."
  else
    fail "응답 200이나 accessToken 없음"
  fi
else
  fail "로그인 실패 → HTTP $STATUS"
  info "응답: $BODY"
  ADMIN_TOKEN=""
fi

# ── 2. VIEWER 로그인 ─────────────────────────────────────────
step "2-2. VIEWER 로그인"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${VIEWER_EMAIL}\",\"password\":\"${VIEWER_PASSWORD}\"}" \
  "${BACKEND_URL}/api/v1/auth/login")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  VIEWER_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
  pass "VIEWER 로그인 성공"
else
  fail "VIEWER 로그인 실패 → HTTP $STATUS"
  VIEWER_TOKEN=""
fi

# ── 3. 잘못된 비밀번호 ───────────────────────────────────────
step "2-3. 잘못된 비밀번호 거부 확인"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"wrong-password\"}" \
  "${BACKEND_URL}/api/v1/auth/login")
STATUS=$(echo "$RESP" | tail -1)

if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  pass "잘못된 비밀번호 → HTTP $STATUS (거부됨)"
else
  fail "잘못된 비밀번호가 거부되지 않음 → HTTP $STATUS"
fi

# ── 4. 없는 계정 ─────────────────────────────────────────────
step "2-4. 없는 이메일 거부 확인"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com","password":"test"}' \
  "${BACKEND_URL}/api/v1/auth/login")
STATUS=$(echo "$RESP" | tail -1)

if [ "$STATUS" = "401" ] || [ "$STATUS" = "404" ] || [ "$STATUS" = "400" ]; then
  pass "없는 계정 → HTTP $STATUS (거부됨)"
else
  fail "없는 계정이 거부되지 않음 → HTTP $STATUS"
fi

# ── 5. 토큰 없이 보호된 API 접근 ─────────────────────────────
step "2-5. 토큰 없이 /api/v1/storages 접근"
RESP=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/api/v1/storages")
STATUS=$(echo "$RESP" | tail -1)

if [ "$STATUS" = "401" ]; then
  pass "미인증 요청 → HTTP 401"
else
  fail "미인증 요청이 허용됨 → HTTP $STATUS"
fi

# ── 6. 유효한 토큰으로 보호된 API 접근 ───────────────────────
step "2-6. 유효한 토큰으로 /api/v1/storages 접근"
if [ -n "${ADMIN_TOKEN:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${BACKEND_URL}/api/v1/storages")
  STATUS=$(echo "$RESP" | tail -1)
  if [ "$STATUS" = "200" ]; then
    pass "유효한 토큰 → HTTP 200"
  else
    fail "유효한 토큰인데 실패 → HTTP $STATUS"
  fi
else
  skip "ADMIN_TOKEN 없음 → 로그인 실패로 스킵"
fi

# ── 7. VIEWER가 ADMIN 전용 API 접근 ──────────────────────────
step "2-7. VIEWER 계정으로 /api/v1/storages POST (ADMIN 필요)"
if [ -n "${VIEWER_TOKEN:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${VIEWER_TOKEN}" \
    -d '{"name":"hack","provider":"ON_PREMISE","bucketOrPath":"/tmp"}' \
    "${BACKEND_URL}/api/v1/storages")
  STATUS=$(echo "$RESP" | tail -1)
  if [ "$STATUS" = "403" ]; then
    pass "VIEWER → POST /storages HTTP 403 (권한 없음)"
  else
    fail "VIEWER가 ADMIN API 접근 가능 → HTTP $STATUS"
  fi
else
  skip "VIEWER_TOKEN 없음 → 스킵"
fi

print_summary
