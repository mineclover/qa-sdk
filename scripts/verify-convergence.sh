#!/usr/bin/env bash
#
# verify-convergence.sh — 런타임 이벤트 → convergence pipeline E2E 검증.
#
# 사용법:
#   1. ingest-server 시작: CONVERGENCE_ENABLED=true pnpm --filter @qa-sdk/ingest-server dev
#   2. 이 스크립트 실행: bash scripts/verify-convergence.sh
#
# 전제:
#   - ingest-server가 localhost:3200에서 실행 중
#   - CONVERGENCE_ENABLED=true 설정됨
#   - PostgreSQL + Redis 실행 중 (또는 인라인 모드)
#

set -euo pipefail

INGEST_URL="${INGEST_URL:-http://localhost:3200}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID="ses_verify_$(date +%s)"
TRACE_ID="trc_verify_$(date +%s)"

echo "══ Convergence E2E Verification ══"
echo "  ingest: $INGEST_URL"
echo "  session: $SESSION_ID"
echo "  trace: $TRACE_ID"
echo

# ── Step 1: Health check ──────────────────────────
echo "1. Health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$INGEST_URL/v1/health")
if [ "$HTTP_STATUS" != "200" ]; then
  echo "   FAIL: ingest-server not reachable (HTTP $HTTP_STATUS)"
  echo "   → CONVERGENCE_ENABLED=true pnpm --filter @qa-sdk/ingest-server dev"
  exit 1
fi
echo "   OK (HTTP $HTTP_STATUS)"
echo

# ── Step 2: Send events (13개 shop-web 트래킹 포인트 시뮬레이션) ──
echo "2. Sending 5 simulated events..."

send_event() {
  local EVENT_KEY="$1"
  local ADDR_CTX="$2"
  local LOG_ID="log_$(date +%s%N | cut -c1-13)_$RANDOM"

  curl -s -X POST "$INGEST_URL/v1/ingest" \
    -H "Content-Type: application/json" \
    -d "{
      \"transmission_id\": \"tx_verify_$RANDOM\",
      \"sent_at\": \"$TIMESTAMP\",
      \"owner\": { \"owner_type\": \"workspace\", \"owner_id\": \"verify-script\" },
      \"source\": { \"service_name\": \"shopping-web\", \"sdk_name\": \"@qa-sdk/shop\", \"sdk_version\": \"0.1.0\" },
      \"runtime\": { \"platform\": \"script\" },
      \"build\": { \"env\": \"dev\" },
      \"records\": [{
        \"log_id\": \"$LOG_ID\",
        \"timestamp\": \"$TIMESTAMP\",
        \"record_kind\": \"log\",
        \"trace_id\": \"$TRACE_ID\",
        \"span_id\": \"spn_$RANDOM\",
        \"event_key\": \"$EVENT_KEY\",
        \"event_version\": \"001\",
        \"payload_format\": \"json\",
        \"payload_encoding\": \"raw\",
        \"payload\": { \"event\": \"$EVENT_KEY\" },
        \"address_context\": $ADDR_CTX,
        \"qa_session_id\": \"$SESSION_ID\"
      }]
    }" > /dev/null

  echo "   -> $EVENT_KEY sent"
}

# 실제 address_context 값 (DEMO_CATALOG 기반 인코딩)
send_event "page.home" '{"tracking":"tracking:v2:0","page_view":"page_view:v1:0"}'
send_event "cart.add" '{"tracking":"tracking:v2:16","cart_event":"cart_event:v1:0"}'
send_event "auth.login" '{"tracking":"tracking:v2:32","auth_event":"auth_event:v1:0"}'
send_event "checkout.process" '{"tracking":"tracking:v2:48","flow_point":"flow_point:v2:0"}'
send_event "payment.success" '{"tracking":"tracking:v2:64","order_event":"order_event:v1:0"}'

echo

# ── Step 3: Wait for convergence flush ────────────
echo "3. Waiting for convergence flush (15s)..."
sleep 15
echo "   OK"
echo

# ── Step 4: Check convergence result ──────────────
echo "4. Checking convergence via CLI..."
echo
node packages/cli/dist/index.js dkg converge --verbose 2>&1 | head -30
echo
echo "══ Verification Complete ══"
echo "  다음 확인 사항:"
echo "  - 'auto observations' 건수 확인"
echo "  - coverage metric이 N/A가 아닌 값이면 성공"
echo "  - DKG SQLite에 usage snapshot 생성 확인"
