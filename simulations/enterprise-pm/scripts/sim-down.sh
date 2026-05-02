#!/usr/bin/env bash
# Enterprise PM 시뮬 종료 — 시뮬 컨테이너만 제거 (본체 컨테이너는 유지)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SIM_DIR"

REMOVE_VOLUMES="${1:-}"

echo "==> 시뮬 컨테이너 종료"
if [[ "$REMOVE_VOLUMES" == "--volumes" || "$REMOVE_VOLUMES" == "-v" ]]; then
  echo "  ⚠ --volumes 지정됨 — sim-redis-data 삭제"
  docker compose -f docker-compose.sim.yaml down --volumes --remove-orphans
else
  docker compose -f docker-compose.sim.yaml down --remove-orphans
fi

echo ""
echo "✓ 시뮬 종료 완료"
echo "본체 컨테이너(qa-sdk-db, ingest-server)는 유지됩니다."
echo "본체 종료: cd ../../packages/infra-engine && docker compose -f docker-compose.infra.yaml --env-file .env.docker down"
