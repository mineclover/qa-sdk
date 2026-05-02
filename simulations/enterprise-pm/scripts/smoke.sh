#!/usr/bin/env bash
# Plan 14b — sim 통합 smoke.
# 사용법: ./scripts/smoke.sh [--keep-up] [--skip-density]
#
# 단계: infra → sim 인프라 → 9 서비스 health 폴링 → 8 시나리오 batch → density.
# exit code: 0 (all passed) / 1 (any unhealthy or scenario fail).
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.sim.yaml"
INFRA_COMPOSE="docker compose -f ../../packages/infra-engine/docker-compose.infra.yaml"
KEEP_UP=0
SKIP_DENSITY=0
for arg in "$@"; do
  case "$arg" in
    --keep-up) KEEP_UP=1 ;;
    --skip-density) SKIP_DENSITY=1 ;;
    -h|--help)
      echo "usage: ./scripts/smoke.sh [--keep-up] [--skip-density]"
      exit 0
      ;;
  esac
done

cleanup() {
  if [ "$KEEP_UP" -eq 0 ]; then
    echo "==> teardown (--keep-up 로 유지 가능)"
    $COMPOSE down || true
  fi
}
trap cleanup EXIT

echo "==> 1. infra (qa-sdk-db) 부팅"
$INFRA_COMPOSE up -d qa-sdk-db
sleep 5

echo "==> 2. sim 인프라 (redis + 9 서비스) 부팅"
$COMPOSE up -d
sleep 10

echo "==> 3. 9 서비스 health 폴링 (최대 60초/서비스)"
SERVICES=(
  "sim-auth-api:4400"
  "sim-pm-api:4500"
  "sim-approval-api:4600"
  "sim-notification-api:4700"
  "sim-reporting-api:4800"
  "sim-document-api:4900"
  "sim-audit-browser-api:5100"
  "sim-gateway:8888"
  "sim-metrics-collector:5200"
)
for entry in "${SERVICES[@]}"; do
  name=${entry%:*}
  port=${entry#*:}
  ok=0
  for _ in $(seq 1 30); do
    if curl -fsS "http://localhost:$port/health" > /dev/null 2>&1; then
      echo "  ok $name (:$port)"
      ok=1
      break
    fi
    sleep 2
  done
  if [ "$ok" -eq 0 ]; then
    echo "  fail $name (:$port) — health 응답 없음"
    exit 1
  fi
done

echo "==> 4. 8 시나리오 batch 실행"
SCENARIOS_RESULT=/tmp/sim-smoke-scenarios.json
node scenarios/dist/cli.js run --all --json \
  --gateway-url http://localhost:8888 \
  > "$SCENARIOS_RESULT" 2>&1 || true

jq -r '.[] | "\(.status) \(.name) (\(.durationMs)ms)"' "$SCENARIOS_RESULT"
PASSED=$(jq '[.[] | select(.status == "passed")] | length' "$SCENARIOS_RESULT")
FAILED=$(jq '[.[] | select(.status == "failed")] | length' "$SCENARIOS_RESULT")
echo "  → passed=$PASSED failed=$FAILED"

if [ "$SKIP_DENSITY" -eq 0 ]; then
  echo "==> 5. density 측정 (sim.bitmap, uv1)"
  node scenarios/dist/cli.js density \
    --prefix=sim.bitmap --version=uv1 \
    --reporting-url=http://localhost:4800 \
    || echo "  [!] density 측정 실패 — 시나리오 결과 데이터 누락 가능"
fi

if [ "$FAILED" -gt 0 ]; then
  echo "✗ smoke 실패: $FAILED 시나리오 fail"
  exit 1
fi
echo "✓ smoke 통과: $PASSED 시나리오 모두 passed"
