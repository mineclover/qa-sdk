#!/usr/bin/env bash
# qa-sdk-db sim schema + sim_app role 검증 — Plan 09b 마무리
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

CONTAINER="qa-sdk-db"

echo "==> qa-sdk-db 컨테이너 healthcheck 대기"
for i in $(seq 1 12); do
  status=$(docker compose -f docker-compose.infra.yaml --env-file .env.docker ps --format json $CONTAINER 2>/dev/null | jq -r '.Health' 2>/dev/null || echo "starting")
  if [[ "$status" == "healthy" ]]; then
    echo "  → healthy"
    break
  fi
  echo "  → $status (대기 ${i}/12)"
  sleep 5
done

echo "==> qa_sdk DB의 sim schema 존재 확인"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT nspname FROM pg_namespace WHERE nspname = 'sim';"

echo "==> qa_sdk_test DB의 sim schema 존재 확인"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T $CONTAINER \
  psql -U postgres -d qa_sdk_test -tA \
  -c "SELECT nspname FROM pg_namespace WHERE nspname = 'sim';"

echo "==> sim_app role 존재 확인"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T $CONTAINER \
  psql -U postgres -tA \
  -c "SELECT rolname FROM pg_roles WHERE rolname = 'sim_app';"

echo "==> sim_app의 sim schema USAGE 권한 확인"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT has_schema_privilege('sim_app', 'sim', 'USAGE');"

echo "==> qa_admin의 sim schema USAGE 권한 확인 (cross-domain)"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT has_schema_privilege('qa_admin', 'sim', 'USAGE');"

echo "==> 전체 schema 6개 확인 (auth/audit/ingest/decision/definition/sim)"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT nspname FROM pg_namespace WHERE nspname IN ('auth','audit','ingest','decision','definition','sim') ORDER BY nspname;"

echo "✓ qa-sdk-db sim schema smoke 통과"
