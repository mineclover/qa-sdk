#!/usr/bin/env bash
# Plan 14a — 8 시나리오 실행 후 marginal density 측정 e2e 스크립트.
# 사전 조건: docker-compose 부팅, 9 서비스 fully ready, ingest-server 부팅.
set -euo pipefail

cd "$(dirname "$0")/.."
SCENARIOS_DIR="$(pwd)/scenarios"
REPORTING_URL=${REPORTING_URL:-http://localhost:4800}

echo "==> 1. 8 시나리오 batch 실행 (--all)"
node "$SCENARIOS_DIR/dist/cli.js" run --all --json > /tmp/sim-scenarios-results.json
PASSED=$(jq '[.[] | select(.status == "passed")] | length' /tmp/sim-scenarios-results.json)
FAILED=$(jq '[.[] | select(.status == "failed")] | length' /tmp/sim-scenarios-results.json)
echo "  → passed=$PASSED failed=$FAILED"

if [ "$FAILED" -gt 0 ]; then
  echo "  [!] 시나리오 실패 — density 측정 진행 (참고용)"
fi

echo "==> 2. density 측정 (sim.bitmap, uv1)"
node "$SCENARIOS_DIR/dist/cli.js" density \
  --prefix=sim.bitmap --version=uv1 --reporting-url="$REPORTING_URL"

echo "==> 3. JSON 출력 — Plan 14b 회귀 자료"
node "$SCENARIOS_DIR/dist/cli.js" density \
  --prefix=sim.bitmap --version=uv1 --reporting-url="$REPORTING_URL" --json \
  > /tmp/sim-density-bitmap.json
echo "  → /tmp/sim-density-bitmap.json 작성"

echo "✓ density 측정 완료"
