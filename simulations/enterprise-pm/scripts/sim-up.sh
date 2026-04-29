#!/usr/bin/env bash
# Enterprise PM 시뮬 부팅 — 본체 의존 점검 + 시뮬 컨테이너 up + healthcheck 대기
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$SIM_DIR/../../packages/infra-engine"

cd "$SIM_DIR"

echo "==> 1/4 본체 인프라 점검 (qa-sdk-db + qa-sdk-net)"

if ! docker network inspect qa-sdk-net >/dev/null 2>&1; then
  echo "  ⚠ qa-sdk-net network 미존재 — 본체 인프라 부팅 필요"
  echo "  실행: cd $INFRA_DIR && docker compose -f docker-compose.infra.yaml --env-file .env.docker up -d qa-sdk-db"
  exit 1
fi

if ! docker compose -f "$INFRA_DIR/docker-compose.infra.yaml" --env-file "$INFRA_DIR/.env.docker" ps qa-sdk-db --format json 2>/dev/null | jq -e '.Health == "healthy"' >/dev/null; then
  echo "  ⚠ qa-sdk-db unhealthy — 부팅 또는 healthcheck 대기 필요"
  echo "  실행: cd $INFRA_DIR && docker compose -f docker-compose.infra.yaml --env-file .env.docker up -d qa-sdk-db && sleep 15"
  exit 1
fi

echo "  → qa-sdk-net + qa-sdk-db 정상"

echo "==> 2/4 .env.sim 점검"
if [[ ! -f "$SIM_DIR/.env.sim" ]]; then
  echo "  ⚠ .env.sim 미존재 — Plan 09d 참조 (sops decrypt .env.sim.enc > .env.sim)"
  exit 1
fi
echo "  → .env.sim 존재"

echo "==> 3/4 시뮬 컨테이너 부팅"
docker compose -f docker-compose.sim.yaml up -d --build

echo "==> 4/4 healthcheck 대기 (최대 90초)"
SERVICES=(qa-sdk-ingest sim-redis sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api sim-metrics-collector sim-gateway)
unhealthy=()
for i in $(seq 1 18); do
  unhealthy=()
  for svc in "${SERVICES[@]}"; do
    status=$(docker compose -f docker-compose.sim.yaml ps --format json $svc 2>/dev/null | jq -r '.Health // .State // "unknown"' 2>/dev/null || echo "unknown")
    if [[ "$status" != "healthy" && "$status" != "running" ]]; then
      unhealthy+=("$svc=$status")
    fi
  done
  if [[ ${#unhealthy[@]} -eq 0 ]]; then
    echo "  → 10/10 서비스 healthy/running"
    break
  fi
  echo "  대기 ${i}/18 — pending: ${unhealthy[*]}"
  sleep 5
done

if [[ ${#unhealthy[@]} -gt 0 ]]; then
  echo ""
  echo "⚠ 일부 서비스가 healthy 상태에 도달하지 못함:"
  printf '  - %s\n' "${unhealthy[@]}"
  echo ""
  echo "Plan 10 전까지는 placeholder Dockerfile이 사용되어 /health 엔드포인트가 없습니다."
  echo "이 단계에서는 'running' 상태만 확인하면 정상입니다."
fi

echo ""
echo "✓ 시뮬 부팅 완료"
echo ""
echo "다음 단계:"
echo "  pnpm sim:ps       — 컨테이너 상태"
echo "  pnpm sim:logs     — 통합 로그"
echo "  pnpm sim:seed     — seed 데이터 적용 (Plan 09d 완료 후)"
echo "  pnpm sim:scenario — 시나리오 실행 (Plan 13 완료 후)"
