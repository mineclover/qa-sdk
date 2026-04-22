#!/usr/bin/env bash
# 긴급 rollback — FORCE 제거. runbook 승인 후에만 실행.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.infra.yaml --env-file .env.docker"

echo "!! ROLLBACK — FORCE ROW LEVEL SECURITY 해제합니다 (Ctrl-C 로 중단)"
sleep 3

$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 < ./init/qa-sdk-db-rollback-enforce.sql

echo "==> 검증: FORCE 해제 확인"
$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT n.nspname || '.' || c.relname || ' forcerowsecurity=' || c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE c.relrowsecurity AND c.relname IN ('resource_policies','audit_entries','key_observations','event_records');"

echo "✓ Rollback 완료. shadow mode 로 복귀. 원인 분석 후 재적용 필요."
