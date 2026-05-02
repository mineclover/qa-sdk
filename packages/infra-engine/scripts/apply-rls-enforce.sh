#!/usr/bin/env bash
# qa-sdk RLS enforce 적용 — 사전 조건 검사 + FORCE 토글.
# 운영 적용 전 shadow-analysis-*.md 승인 필수.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.infra.yaml --env-file .env.docker"

echo "==> 사전 조건 1: qa-sdk-db 컨테이너 healthy"
$COMPOSE ps qa-sdk-db | grep -q healthy || { echo "qa-sdk-db 가 healthy 아님"; exit 1; }

echo "==> 사전 조건 2: helper 함수 4개 배포 확인"
count=$($COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='auth' AND p.proname IN ('current_user_id','has_bit','resource_state','current_role_tag');" | tr -d '[:space:]')
if [[ "$count" != "4" ]]; then
  echo "helper 함수 누락 — Plan 15a apply-rls-helpers.sh 먼저 실행"; exit 1
fi

echo "==> 사전 조건 3: Plan 15b 정책 배포 확인 (rp_select_policy)"
$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT polname FROM pg_policy WHERE polname='rp_select_policy';" | grep -q rp_select_policy \
  || { echo "Plan 15b 정책 미배포 — 해당 plan 먼저 실행"; exit 1; }

echo "==> 사전 조건 4: QA_SDK_ADMIN_BYPASS_PASSWORD 환경 변수"
if [[ -z "${QA_SDK_ADMIN_BYPASS_PASSWORD:-}" ]]; then
  echo "QA_SDK_ADMIN_BYPASS_PASSWORD 미설정 — .env.docker 또는 sops 에서 로드"
  exit 1
fi

echo "==> enforce SQL 적용"
$COMPOSE exec -T -e QA_SDK_ADMIN_BYPASS_PASSWORD qa-sdk-db \
  psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 < ./init/qa-sdk-db-enforce.sql

echo "==> 검증: FORCE 4 테이블 확인"
$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT schemaname || '.' || tablename FROM pg_tables WHERE rowsecurity = true AND tablename IN ('resource_policies','audit_entries','key_observations','key_observation_prefixes','event_records','rls_shadow_decisions') ORDER BY tablename;"

echo "==> 검증: qa_admin_bypass BYPASSRLS"
has_bypass=$($COMPOSE exec -T qa-sdk-db psql -U postgres -tA -c \
  "SELECT rolbypassrls FROM pg_roles WHERE rolname='qa_admin_bypass';")
[[ "$(echo $has_bypass | tr -d '[:space:]')" == "t" ]] || { echo "qa_admin_bypass BYPASSRLS 미보유"; exit 1; }

echo "✓ RLS enforce 적용 완료. 회귀 테스트 실행 권장: pnpm -r test + 시나리오 4 재현"
