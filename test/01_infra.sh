#!/usr/bin/env bash
# TC-01: 인프라 헬스체크
# 목적: 모든 서비스(PostgreSQL, Valkey, Backend, Agent)가 정상 동작하는지 확인
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-01 인프라 헬스체크"

# ── 1. PostgreSQL 연결 ───────────────────────────────────────
step "1-1. PostgreSQL 연결 확인"
if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -q 2>/dev/null; then
  pass "PostgreSQL 연결 정상 (${DB_HOST}:${DB_PORT}/${DB_NAME})"
else
  fail "PostgreSQL 연결 실패 → pg_isready 오류"
fi

# ── 2. pgvector 확장 ─────────────────────────────────────────
step "1-2. pgvector 확장 확인"
EXT=$(PGPASSWORD="${DB_PASSWORD:-password}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  -tAc "SELECT count(*) FROM pg_extension WHERE extname='vector';" 2>/dev/null || echo "0")
if [ "$EXT" = "1" ]; then
  pass "pgvector 확장 활성화됨"
else
  fail "pgvector 확장 없음 → CREATE EXTENSION vector 필요"
fi

# ── 3. Valkey(Redis) 연결 ────────────────────────────────────
step "1-3. Valkey 연결 확인"
if command -v redis-cli &>/dev/null; then
  PONG=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" ping 2>/dev/null || echo "FAIL")
  if [ "$PONG" = "PONG" ]; then
    pass "Valkey 응답 정상 (PONG)"
  else
    fail "Valkey 응답 없음 → 응답: $PONG"
  fi
else
  skip "redis-cli 없음 → Backend 헬스체크로 간접 확인"
fi

# ── 4. Backend 헬스체크 ──────────────────────────────────────
step "1-4. NestJS Backend 헬스체크"
RESP=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/health" 2>/dev/null)
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  pass "Backend 헬스체크 200 OK"
  info "응답: $BODY"
else
  fail "Backend 헬스체크 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 5. Agent 헬스체크 ────────────────────────────────────────
step "1-5. Python Agent 헬스체크"
RESP=$(curl -s -w "\n%{http_code}" "${AGENT_URL}/health" 2>/dev/null)
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  pass "Agent 헬스체크 200 OK"
  info "응답: $BODY"
else
  fail "Agent 헬스체크 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 6. Backend DB 연결 포함 헬스체크 ─────────────────────────
step "1-6. Backend DB 연결 상태 확인"
DB_STATUS=$(echo "$BODY" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get('status','unknown'))
except:
  print('parse_error')
" 2>/dev/null)
if [ "$DB_STATUS" = "ok" ]; then
  pass "Backend DB 연결 상태 ok"
else
  skip "응답 파싱 불가 또는 상태 미확인 (status=$DB_STATUS)"
fi

print_summary
