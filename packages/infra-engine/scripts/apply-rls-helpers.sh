#!/usr/bin/env bash
# qa-sdk-db 기존 volume 에 RLS helper SQL 재적용.
# CREATE OR REPLACE 이므로 몇 번 실행해도 안전.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.infra.yaml --env-file .env.docker"

echo "==> qa-sdk-db-helpers.sql 적용 (qa_sdk)"
$COMPOSE exec -T qa-sdk-db \
  psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/10-qa-sdk-db-helpers.sql \
  || {
    echo "→ bind mount 미적용 상태. 원본 파일을 stdin 으로 전송"
    $COMPOSE exec -T qa-sdk-db \
      psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 < ./init/qa-sdk-db-helpers.sql
  }

echo "==> 함수 존재 확인"
$COMPOSE exec -T qa-sdk-db \
  psql -U postgres -d qa_sdk -tA -c "
    SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'auth'
       AND p.proname IN ('current_user_id','has_bit','resource_state','current_role_tag')
     ORDER BY p.proname;"

echo "✓ RLS helpers 적용 완료"
