#!/usr/bin/env bash
# qa-sdk-db: 기존 PGDATA 볼륨에 replication 런타임 구성 재적용.
#
# 배경
#   postgres docker image 는 /docker-entrypoint-initdb.d/*.sql 을 빈 PGDATA 에서만 실행.
#   기존 볼륨을 유지한 상태에서 replication 토폴로지(replicator role + slot + pg_hba)
#   를 도입하려면 해당 SQL 을 명시적으로 재적용해야 한다.
#
# 안전성
#   - init/qa-sdk-db-replication.sql 은 idempotent (DO + IF NOT EXISTS / WHERE NOT EXISTS).
#   - pg_hba.conf 는 docker-compose volume mount 로 영속화되며 본 스크립트는 SIGHUP 만 보낸다.
#   - 본 스크립트는 데이터 파괴 명령(`docker compose down -v`, `DROP …`) 을 절대 실행하지 않는다.
#
# 사전 조건
#   - .env.docker 에 QA_SDK_REPLICATOR_PASSWORD 정의.
#   - docker-compose.infra.yaml 가 init/pg_hba.conf 를 /etc/postgresql/pg_hba.conf 로 마운트.
#   - qa-sdk-db 컨테이너 실행 중 (`docker compose up -d qa-sdk-db`).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.infra.yaml --env-file .env.docker"

echo "==> qa-sdk-db 컨테이너 상태 확인"
if ! $COMPOSE ps --status running --services 2>/dev/null | grep -qx qa-sdk-db; then
  echo "ERROR: qa-sdk-db 가 실행 중이지 않습니다. 먼저 'docker compose up -d qa-sdk-db' 를 실행하세요." >&2
  exit 1
fi

echo "==> replication SQL idempotent 재적용"
# bind mount 가 적용된 경우 컨테이너 안 경로에서 실행 (env 가 자동 주입됨).
# bind mount 가 아직 적용되지 않은 컨테이너(이전 부팅 잔존)인 경우 stdin fallback.
if $COMPOSE exec -T qa-sdk-db test -f /docker-entrypoint-initdb.d/20-qa-sdk-db-replication.sql; then
  $COMPOSE exec -T qa-sdk-db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
         -f /docker-entrypoint-initdb.d/20-qa-sdk-db-replication.sql
else
  echo "  → bind mount 미적용. stdin 으로 SQL 전달 (env 는 컨테이너에 이미 주입되어 있어야 함)"
  $COMPOSE exec -T qa-sdk-db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    < ./init/qa-sdk-db-replication.sql
fi

echo "==> pg_hba.conf reload (SIGHUP)"
# 마운트된 /etc/postgresql/pg_hba.conf 를 postgres 가 다시 읽도록 한다.
# (pg_reload_conf() 는 재시작 없이 hba_file 을 재로드)
if $COMPOSE exec -T qa-sdk-db test -f /etc/postgresql/pg_hba.conf; then
  $COMPOSE exec -T qa-sdk-db \
    psql -U postgres -d postgres -tA -c "SELECT pg_reload_conf();" \
    > /dev/null
  echo "  → pg_reload_conf() 완료"
else
  echo "  → /etc/postgresql/pg_hba.conf 미발견. docker-compose.infra.yaml volume 설정 확인 필요." >&2
  echo "    (컨테이너 재생성 후 재시도: 'docker compose up -d --force-recreate qa-sdk-db')" >&2
  exit 2
fi

echo "==> 결과 검증"
$COMPOSE exec -T qa-sdk-db psql -U postgres -d postgres -tA -c \
  "SELECT 'replicator role: ' ||
          CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='replicator')
               THEN 'OK' ELSE 'MISSING' END;"

$COMPOSE exec -T qa-sdk-db psql -U postgres -d postgres -tA -c \
  "SELECT 'replication slot: ' ||
          CASE WHEN EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name='sim_read_replica_slot')
               THEN 'OK' ELSE 'MISSING' END;"

$COMPOSE exec -T qa-sdk-db psql -U postgres -d postgres -tA -c \
  "SELECT 'pg_hba entries (replication): ' || COUNT(*)::text
     FROM pg_hba_file_rules
    WHERE 'replication' = ANY(database) AND 'replicator' = ANY(user_name);"

echo "✓ replication 런타임 재적용 완료"
