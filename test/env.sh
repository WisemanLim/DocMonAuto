#!/usr/bin/env bash
# 공통 환경변수 및 헬퍼 함수 (모든 테스트 스크립트가 source)

# ── 엔드포인트 ──────────────────────────────────────────────
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
AGENT_URL="${AGENT_URL:-http://localhost:8080}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-docmonauto}"
DB_USER="${DB_USER:-docmonauto}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# ── 인증 ────────────────────────────────────────────────────
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@docmonauto.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin1234!}"
VIEWER_EMAIL="${VIEWER_EMAIL:-viewer@docmonauto.local}"
VIEWER_PASSWORD="${VIEWER_PASSWORD:-Viewer1234!}"

# ── 에이전트 ────────────────────────────────────────────────
AGENT_SECRET="${AGENT_SECRET:-dev-agent-secret}"
WATCH_PATH="${WATCH_PATH:-/tmp/docmonauto-watch}"
STORAGE_ID="${STORAGE_ID:-00000000-0000-0000-0000-000000000010}"

# ── 출력 헬퍼 ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass()  { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS_COUNT++)); }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL_COUNT++)); }
skip()  { echo -e "${YELLOW}[SKIP]${NC} $1"; ((SKIP_COUNT++)); }
info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
step()  { echo -e "${CYAN}[STEP]${NC} $1"; }
header(){ echo -e "\n${BOLD}━━━ $1 ━━━${NC}"; }

# ── HTTP 헬퍼 ───────────────────────────────────────────────
# 응답 전체(body + status)를 캡처하는 curl wrapper
# 사용: response=$(http_get /api/v1/health)
# 상태코드 추출: status=$(echo "$response" | tail -1)
# body 추출: body=$(echo "$response" | head -n -1)

http_get() {
  local path="$1"
  local token="${2:-}"
  local auth_header=""
  [ -n "$token" ] && auth_header="-H \"Authorization: Bearer $token\""
  eval curl -s -w "\\n%{http_code}" "$auth_header" "${BACKEND_URL}${path}"
}

http_post() {
  local path="$1"
  local data="$2"
  local token="${3:-}"
  local auth_header=""
  [ -n "$token" ] && auth_header="-H \"Authorization: Bearer $token\""
  eval curl -s -w "\\n%{http_code}" -X POST \
    -H "'Content-Type: application/json'" \
    "$auth_header" \
    -d "'${data}'" \
    "'${BACKEND_URL}${path}'"
}

http_delete() {
  local path="$1"
  local token="${2:-}"
  local auth_header=""
  [ -n "$token" ] && auth_header="-H \"Authorization: Bearer $token\""
  eval curl -s -w "\\n%{http_code}" -X DELETE "$auth_header" "${BACKEND_URL}${path}"
}

# 응답에서 body와 status_code 분리
split_response() {
  # 마지막 줄 = status code, 나머지 = body
  RESPONSE_BODY=$(echo "$1" | head -n -1)
  RESPONSE_STATUS=$(echo "$1" | tail -1)
}

# JSON 필드 추출 (python3 필요)
json_field() {
  local json="$1"
  local field="$2"
  echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('${field}',''))" 2>/dev/null
}

# 에이전트 직접 호출 (x-agent-secret 헤더)
agent_post() {
  local path="$1"
  local data="$2"
  curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "x-agent-secret: ${AGENT_SECRET}" \
    -d "${data}" \
    "${AGENT_URL}${path}"
}

# 결과 요약 출력
print_summary() {
  echo ""
  echo -e "${BOLD}────────────────────────────────${NC}"
  echo -e "${BOLD}테스트 결과 요약${NC}"
  echo -e "${GREEN}PASS: ${PASS_COUNT}${NC}"
  echo -e "${RED}FAIL: ${FAIL_COUNT}${NC}"
  [ $SKIP_COUNT -gt 0 ] && echo -e "${YELLOW}SKIP: ${SKIP_COUNT}${NC}"
  echo -e "${BOLD}────────────────────────────────${NC}"
  [ $FAIL_COUNT -eq 0 ] && return 0 || return 1
}

# JWT 로그인 → 토큰 반환
login() {
  local email="$1"
  local password="$2"
  local resp
  resp=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
    "${BACKEND_URL}/api/v1/auth/login")
  echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null
}

# 감시 디렉토리 준비
ensure_watch_dir() {
  mkdir -p "${WATCH_PATH}"
}
