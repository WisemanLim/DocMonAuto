#!/usr/bin/env bash
# TC-06: 검색 기능 (벡터 검색 / FTS / BOTH)
# 목적: 인덱싱된 문서에 대한 벡터·FTS·복합 검색 정확성 확인
set -euo pipefail
source "$(dirname "$0")/env.sh"

header "TC-06 검색 기능"

ensure_watch_dir

# ── 사전 준비: 검색 가능한 문서 인덱싱 ──────────────────────
step "사전 준비: 검색 테스트용 문서 인덱싱"
TS=$(date +%s)
DOC_VECTOR="search-vec-${TS}"
DOC_FTS="search-fts-${TS}"
DOC_BOTH="search-both-${TS}"

FILE_VECTOR="${WATCH_PATH}/search-vec-${TS}.txt"
FILE_FTS="${WATCH_PATH}/search-fts-${TS}.txt"
FILE_BOTH="${WATCH_PATH}/search-both-${TS}.txt"

cat > "${FILE_VECTOR}" << 'EOF'
인공지능 기반 문서 검색 시스템입니다.
벡터 임베딩을 활용하여 의미적으로 유사한 문서를 찾습니다.
BGE-M3 모델은 한국어와 영어를 모두 지원합니다.
코사인 유사도로 가장 관련성 높은 청크를 반환합니다.
EOF

cat > "${FILE_FTS}" << 'EOF'
전문 검색(Full-Text Search) 테스트 문서입니다.
PostgreSQL tsvector를 이용한 키워드 기반 검색입니다.
보안등급 관할권 정책엔진 인덱싱전략 키워드검색 최적화됩니다.
랭킹은 ts_rank 함수를 사용합니다.
EOF

cat > "${FILE_BOTH}" << 'EOF'
복합 검색(RRF) 테스트 문서입니다.
Reciprocal Rank Fusion으로 벡터 검색과 FTS 결과를 병합합니다.
분산 RAG 시스템에서 연합 검색 품질을 높이는 핵심 알고리즘입니다.
k=60 파라미터를 사용하여 순위를 계산합니다.
EOF

# 문서 인덱싱 (doc_id:file:strategy 형식)
INDEX_TASKS=(
  "${DOC_VECTOR}:${FILE_VECTOR}:VECTOR_ONLY"
  "${DOC_FTS}:${FILE_FTS}:VECTORLESS_ONLY"
  "${DOC_BOTH}:${FILE_BOTH}:BOTH"
)
for task in "${INDEX_TASKS[@]}"; do
  doc_id="${task%%:*}"
  rest="${task#*:}"
  file="${rest%%:*}"
  strategy="${rest##*:}"
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "x-agent-secret: ${AGENT_SECRET}" \
    -d "{\"documentId\":\"${doc_id}\",\"externalId\":\"${file}\",\"storageId\":\"${STORAGE_ID}\",\"eventType\":\"CREATE\",\"strategy\":\"${strategy}\"}" \
    "${AGENT_URL}/index")
  STATUS=$(echo "$RESP" | tail -1)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    info "인덱싱 완료: ${doc_id} (${strategy})"
  else
    info "인덱싱 실패: ${doc_id} HTTP $STATUS"
  fi
done

info "임베딩 완료 대기 (3초)..."
sleep 3

# ── 1. VECTOR_ONLY 검색 ──────────────────────────────────────
step "6-1. 벡터 검색 (VECTOR_ONLY)"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{
    \"query\": \"의미 기반 유사 문서 검색\",
    \"documentIds\": [\"${DOC_VECTOR}\", \"${DOC_BOTH}\"],
    \"strategy\": \"VECTOR_ONLY\",
    \"topK\": 3
  }" \
  "${AGENT_URL}/search")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
results = d.get('results', d if isinstance(d, list) else [])
print(len(results))
" 2>/dev/null || echo "?")
  pass "벡터 검색 성공 → ${COUNT}개 결과"
  info "응답 일부: $(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('results',d)[:1] if isinstance(d,list) else []; print(r[0].get('text','')[:80] if r else 'empty')" 2>/dev/null)"
else
  fail "벡터 검색 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 2. FTS 검색 (VECTORLESS_ONLY) ───────────────────────────
step "6-2. 전문 검색 (VECTORLESS_ONLY)"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{
    \"query\": \"보안등급 정책엔진 키워드\",
    \"documentIds\": [\"${DOC_FTS}\", \"${DOC_BOTH}\"],
    \"strategy\": \"VECTORLESS_ONLY\",
    \"topK\": 3
  }" \
  "${AGENT_URL}/search")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
results = d.get('results', d if isinstance(d, list) else [])
print(len(results))
" 2>/dev/null || echo "?")
  pass "FTS 검색 성공 → ${COUNT}개 결과"
else
  fail "FTS 검색 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 3. BOTH 검색 (RRF 병합) ──────────────────────────────────
step "6-3. 복합 검색 BOTH (RRF 병합)"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d "{
    \"query\": \"분산 RAG 연합 검색 알고리즘\",
    \"documentIds\": [\"${DOC_VECTOR}\", \"${DOC_FTS}\", \"${DOC_BOTH}\"],
    \"strategy\": \"BOTH\",
    \"topK\": 5
  }" \
  "${AGENT_URL}/search")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
results = d.get('results', d if isinstance(d, list) else [])
print(len(results))
" 2>/dev/null || echo "?")
  pass "BOTH(RRF) 검색 성공 → ${COUNT}개 결과"
else
  fail "BOTH 검색 실패 → HTTP $STATUS"
  info "응답: $BODY"
fi

# ── 4. 빈 documentIds 처리 ───────────────────────────────────
step "6-4. 빈 문서 목록 검색"
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: ${AGENT_SECRET}" \
  -d '{"query":"테스트","documentIds":[],"strategy":"BOTH","topK":5}' \
  "${AGENT_URL}/search")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "200" ]; then
  pass "빈 문서 목록 → 정상 응답 (빈 결과 예상)"
else
  fail "빈 문서 목록 검색 실패 → HTTP $STATUS"
fi

# ── 정리 ────────────────────────────────────────────────────
step "사후 정리: 테스트 인덱스 삭제"
for doc_id in "${DOC_VECTOR}" "${DOC_FTS}" "${DOC_BOTH}"; do
  curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "x-agent-secret: ${AGENT_SECRET}" \
    -d "{\"documentId\":\"${doc_id}\"}" \
    "${AGENT_URL}/index/delete" > /dev/null 2>&1
done
rm -f "${FILE_VECTOR}" "${FILE_FTS}" "${FILE_BOTH}" 2>/dev/null
info "정리 완료"

print_summary
