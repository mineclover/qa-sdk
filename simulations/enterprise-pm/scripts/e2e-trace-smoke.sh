#!/usr/bin/env bash
# Plan 12c — trace 일관성 e2e smoke
# 사용법: ./e2e-trace-smoke.sh
# 사전: docker-compose.sim.yaml (qa-sdk-db + sim-redis) 부팅, 9 서비스 부팅 완료
set -euo pipefail

GATEWAY=${GATEWAY:-http://localhost:8888}
AUDIT_API=${AUDIT_API:-http://localhost:5100}
INGEST_API=${INGEST_API:-http://localhost:3200}

echo "==> 1. /auth/login"
LOGIN=$(curl -fsS -X POST "$GATEWAY/auth/login" \
  -H "content-type: application/json" \
  -d '{"email":"alice@example.com","password":"test123"}')
TOKEN=$(echo "$LOGIN" | jq -r '.token')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "login 실패"; echo "$LOGIN"; exit 1
fi
echo "  -> token 발급 OK"

echo "==> 2. GET /projects (gateway -> pm-api -> AccessChecker -> audit 기록)"
PROJ_RES=$(curl -fsS -D /tmp/headers.txt "$GATEWAY/projects" \
  -H "Authorization: Bearer $TOKEN")
TRACE_ID=$(grep -i "^x-trace-id:" /tmp/headers.txt | awk '{print $2}' | tr -d '\r' || echo "")
echo "  -> 응답 일부: ${PROJ_RES:0:100}"
echo "  -> trace_id (응답 헤더): $TRACE_ID"

echo "==> 3. trace_id로 audit-browser-api 조회 (Plan 13a에서 구체 매칭)"
if [ -n "$TRACE_ID" ]; then
  echo "  -> trace_id 추출 OK"
else
  echo "  -> WARN: trace_id가 응답 헤더에 노출되지 않음 — gateway middleware 점검 필요"
fi

echo "==> 4. ingest-server에서 sim-pm-api 로그 수신 확인"
LOG_COUNT=$(curl -fsS "$INGEST_API/observation?service=sim-pm-api" 2>/dev/null | jq '.observations | length' 2>/dev/null || echo "0")
echo "  -> sim-pm-api log count: $LOG_COUNT"

echo "done. 추가 검증은 Plan 13a 시나리오 1 + audit-browser-api 통합"
