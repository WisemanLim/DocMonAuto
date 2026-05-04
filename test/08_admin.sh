#!/usr/bin/env bash
# TC-08: 관리자 API
# 목적: 대시보드 통계, 에이전트 관리, 질의 로그, 에이전트 Ping 확인
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-08 관리자 API"

ADMIN_TOKEN=$(login "${ADMIN_EMAIL}" "${ADMIN_PASSWORD}")
[ -z "$ADMIN_TOKEN" ] && { fail "로그인 실패"; print_summary; exit 1; }
pass "로그인 성공"

VIEWER_TOKEN=$(login "${VIEWER_EMAIL}" "${VIEWER_PASSWORD}")

# ── 1. 대시보드 통계 ─────────────────────────────────────────
step "8-1. 관리자 대시보드 통계"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/admin/dashboard")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  DOCS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totalDocuments','?'))" 2>/dev/null)
  STORAGES=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('activeStorages','?'))" 2>/dev/null)
  AGENTS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('onlineAgents','?'))" 2>/dev/null)
  pass "대시보드 조회 성공 → 문서: ${DOCS} / 스토리지: ${STORAGES} / 에이전트: ${AGENTS}"
else
  fail "대시보드 조회 실패 → HTTP $STATUS"
fi

# ── 2. VIEWER의 대시보드 접근 차단 ───────────────────────────
step "8-2. VIEWER → 대시보드 접근 차단 확인"
if [ -n "${VIEWER_TOKEN:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${VIEWER_TOKEN}" \
    "${BACKEND_URL}/api/v1/admin/dashboard")
  STATUS=$(echo "$RESP" | tail -1)
  if [ "$STATUS" = "403" ]; then
    pass "VIEWER → /admin/dashboard HTTP 403 (차단됨)"
  else
    fail "VIEWER가 대시보드 접근 가능 → HTTP $STATUS"
  fi
else
  skip "VIEWER_TOKEN 없음"
fi

# ── 3. 에이전트 목록 조회 ────────────────────────────────────
step "8-3. 에이전트 목록 조회"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/admin/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  pass "에이전트 목록 조회 성공 → ${COUNT}개"
  FIRST_AGENT_ID=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d[0]['id'] if d else '')
" 2>/dev/null)
else
  fail "에이전트 목록 조회 실패 → HTTP $STATUS"
  FIRST_AGENT_ID=""
fi

# ── 4. 에이전트 등록 ─────────────────────────────────────────
step "8-4. 새 에이전트 등록"
TS=$(date +%s)
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{\"name\":\"test-agent-${TS}\",\"endpoint\":\"http://localhost:8090\"}" \
  "${BACKEND_URL}/api/v1/admin/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  NEW_AGENT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  pass "에이전트 등록 성공 → ID: ${NEW_AGENT_ID}"
else
  fail "에이전트 등록 실패 → HTTP $STATUS"
  NEW_AGENT_ID=""
fi

# ── 5. 에이전트 Ping ─────────────────────────────────────────
step "8-5. 실제 에이전트 Ping (응답 확인)"
if [ -n "${FIRST_AGENT_ID:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${BACKEND_URL}/api/v1/admin/agents/${FIRST_AGENT_ID}/ping")
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)
  if [ "$STATUS" = "200" ]; then
    LATENCY=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('latencyMs','?'))" 2>/dev/null)
    AGENT_STATUS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
    pass "에이전트 Ping 성공 → 상태: ${AGENT_STATUS} / 레이턴시: ${LATENCY}ms"
  else
    fail "에이전트 Ping 실패 → HTTP $STATUS (에이전트 미실행 시 정상)"
    info "응답: $BODY"
  fi
else
  skip "등록된 에이전트 없음"
fi

# ── 6. 오프라인 에이전트 Ping (실패 허용) ─────────────────────
step "8-6. 오프라인 에이전트 Ping (실패 허용)"
if [ -n "${NEW_AGENT_ID:-}" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${BACKEND_URL}/api/v1/admin/agents/${NEW_AGENT_ID}/ping")
  STATUS=$(echo "$RESP" | tail -1)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "503" ] || [ "$STATUS" = "502" ]; then
    pass "오프라인 에이전트 Ping → HTTP $STATUS (에러 처리 정상)"
  else
    fail "오프라인 Ping 응답 이상 → HTTP $STATUS"
  fi
else
  skip "NEW_AGENT_ID 없음"
fi

# ── 7. 전체 질의 로그 조회 ───────────────────────────────────
step "8-7. 전체 질의 로그 조회 (ADMIN)"
RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BACKEND_URL}/api/v1/admin/query-logs")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  pass "질의 로그 조회 성공 → ${COUNT}개"
else
  fail "질의 로그 조회 실패 → HTTP $STATUS"
fi

# ── 정리 ────────────────────────────────────────────────────
step "사후 정리: 테스트 에이전트 삭제 시도"
if [ -n "${NEW_AGENT_ID:-}" ]; then
  info "테스트 에이전트 ID: ${NEW_AGENT_ID} (수동 삭제 필요 시 DB에서 직접 처리)"
fi

print_summary
