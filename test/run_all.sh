#!/usr/bin/env bash
# 전체 테스트 실행 스크립트
# 사용법:
#   ./run_all.sh           → 전체 테스트
#   ./run_all.sh 01 03 07  → 지정 테스트만
#   ./run_all.sh --help    → 도움말
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/env.sh"

SCRIPTS=(
  "01_infra.sh"
  "02_auth.sh"
  "03_storages.sh"
  "04_policies.sh"
  "05_indexing.sh"
  "06_search.sh"
  "07_query.sh"
  "08_admin.sh"
)

SCRIPT_DESC=(
  "TC-01 인프라 헬스체크"
  "TC-02 인증"
  "TC-03 스토리지 관리"
  "TC-04 정책 관리"
  "TC-05 문서 인덱싱 파이프라인"
  "TC-06 검색 기능"
  "TC-07 RAG 질의응답 엔드투엔드"
  "TC-08 관리자 API"
)

if [ "${1:-}" = "--help" ]; then
  echo ""
  echo "사용법: $0 [번호...]"
  echo ""
  echo "번호 없음: 전체 실행"
  echo "번호 지정: 해당 테스트만 실행 (예: ./run_all.sh 01 05 07)"
  echo ""
  echo "사용 가능한 테스트:"
  for i in "${!SCRIPTS[@]}"; do
    printf "  %s  →  %s\n" "${SCRIPTS[$i]}" "${SCRIPT_DESC[$i]}"
  done
  echo ""
  echo "환경변수 재정의 예시:"
  echo "  BACKEND_URL=http://prod:3001 AGENT_URL=http://prod:8080 ./run_all.sh"
  exit 0
fi

# 실행할 스크립트 결정
if [ $# -gt 0 ]; then
  RUN_SCRIPTS=()
  for arg in "$@"; do
    for script in "${SCRIPTS[@]}"; do
      if [[ "$script" == "${arg}"* ]]; then
        RUN_SCRIPTS+=("$script")
        break
      fi
    done
  done
else
  RUN_SCRIPTS=("${SCRIPTS[@]}")
fi

# ── 실행 전 사전 확인 ────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  DocMonAuto 통합 테스트 실행${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Backend:  ${BACKEND_URL}"
echo -e "  Agent:    ${AGENT_URL}"
echo -e "  Watch:    ${WATCH_PATH}"
echo ""
echo -e "  실행할 테스트 (${#RUN_SCRIPTS[@]}개):"
for script in "${RUN_SCRIPTS[@]}"; do
  echo "    - $script"
done
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0
FAILED_SCRIPTS=()
LOG_DIR="${DIR}/logs/$(date +%Y%m%d_%H%M%S)"
mkdir -p "${LOG_DIR}"

# ── 테스트 순차 실행 ─────────────────────────────────────────
for script in "${RUN_SCRIPTS[@]}"; do
  SCRIPT_PATH="${DIR}/${script}"
  if [ ! -f "$SCRIPT_PATH" ]; then
    echo -e "${YELLOW}[SKIP]${NC} $script 파일 없음"
    continue
  fi

  LOG_FILE="${LOG_DIR}/${script%.sh}.log"
  echo -e "${CYAN}▶ 실행: ${script}${NC}"

  set +e
  bash "${SCRIPT_PATH}" 2>&1 | tee "${LOG_FILE}"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  # 로그에서 PASS/FAIL/SKIP 카운트 추출
  S_PASS=$(grep -c "^\[PASS\]" "${LOG_FILE}" 2>/dev/null || true)
  S_FAIL=$(grep -c "^\[FAIL\]" "${LOG_FILE}" 2>/dev/null || true)
  S_SKIP=$(grep -c "^\[SKIP\]" "${LOG_FILE}" 2>/dev/null || true)

  # ANSI 코드 제거 후 재집계
  S_PASS=$(grep -cP "\[PASS\]" "${LOG_FILE}" 2>/dev/null || echo 0)
  S_FAIL=$(grep -cP "\[FAIL\]" "${LOG_FILE}" 2>/dev/null || echo 0)
  S_SKIP=$(grep -cP "\[SKIP\]" "${LOG_FILE}" 2>/dev/null || echo 0)

  TOTAL_PASS=$(( TOTAL_PASS + S_PASS ))
  TOTAL_FAIL=$(( TOTAL_FAIL + S_FAIL ))
  TOTAL_SKIP=$(( TOTAL_SKIP + S_SKIP ))

  if [ $EXIT_CODE -ne 0 ] || [ "${S_FAIL}" -gt 0 ]; then
    FAILED_SCRIPTS+=("$script")
    echo -e "${RED}✗ ${script} 실패 (PASS=${S_PASS} FAIL=${S_FAIL} SKIP=${S_SKIP})${NC}"
  else
    echo -e "${GREEN}✓ ${script} 완료 (PASS=${S_PASS} FAIL=${S_FAIL} SKIP=${S_SKIP})${NC}"
  fi
  echo ""
done

# ── 최종 요약 ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  전체 테스트 결과 요약${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}총 PASS: ${TOTAL_PASS}${NC}"
echo -e "  ${RED}총 FAIL: ${TOTAL_FAIL}${NC}"
[ $TOTAL_SKIP -gt 0 ] && echo -e "  ${YELLOW}총 SKIP: ${TOTAL_SKIP}${NC}"
echo ""
echo -e "  로그 저장 위치: ${LOG_DIR}/"
echo ""

if [ ${#FAILED_SCRIPTS[@]} -gt 0 ]; then
  echo -e "${RED}  실패한 스크립트:${NC}"
  for f in "${FAILED_SCRIPTS[@]}"; do
    echo -e "    ${RED}✗ $f${NC}"
  done
  echo ""
  exit 1
else
  echo -e "${GREEN}  모든 테스트 통과!${NC}"
  echo ""
  exit 0
fi
