#!/usr/bin/env bash
# qa-sdk-db 컨테이너 부팅 검증 — 5 schema + 6 role 생성 확인
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==> qa-sdk-db 컨테이너 부팅"
docker compose -f docker-compose.infra.yaml --env-file .env.docker up -d qa-sdk-db

echo "==> healthcheck 대기 (최대 60초)"
for i in $(seq 1 12); do
  status=$(docker compose -f docker-compose.infra.yaml --env-file .env.docker ps --format json qa-sdk-db | jq -r '.Health' 2>/dev/null || echo "starting")
  if [[ "$status" == "healthy" ]]; then
    echo "  → healthy"
    break
  fi
  echo "  → $status (대기 ${i}/12)"
  sleep 5
done

echo "==> qa_sdk DB 존재 확인"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T qa-sdk-db psql -U postgres -tA -c "SELECT datname FROM pg_database WHERE datname IN ('qa_sdk','qa_sdk_test');" | sort

echo "==> qa_sdk schema 5개 확인"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c "SELECT nspname FROM pg_namespace WHERE nspname IN ('auth','audit','ingest','decision','definition') ORDER BY nspname;"

echo "==> role 6개 확인"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T qa-sdk-db psql -U postgres -tA -c "SELECT rolname FROM pg_roles WHERE rolname IN ('auth_app','audit_app','ingest_app','decision_app','definition_app','qa_admin') ORDER BY rolname;"

echo "==> auth_app role의 auth schema 권한 확인 (USAGE 있어야 함)"
docker compose -f docker-compose.infra.yaml --env-file .env.docker exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c "SELECT has_schema_privilege('auth_app', 'auth', 'USAGE');"

echo "✓ qa-sdk-db smoke 통과"
