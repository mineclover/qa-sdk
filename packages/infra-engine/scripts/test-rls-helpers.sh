#!/usr/bin/env bash
# RLS helper 함수 정확성 smoke — bit offset / null-safe / resource_state 구역 구분.
set -euo pipefail

COMPOSE="docker compose -f /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/docker-compose.infra.yaml --env-file /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker"
run_sql() {
  # -tA: tuples-only + unaligned. -q: quiet (no status). 마지막 비빈 라인을 결과로 채택.
  $COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -q -v ON_ERROR_STOP=1 -c "$1" \
    | grep -v '^$' | tail -1
}

expect() {
  local got="$1"
  local want="$2"
  local label="$3"
  if [[ "$got" == "$want" ]]; then
    echo "  ✓ $label"
  else
    echo "  ✗ $label — got=[$got] want=[$want]"; exit 1
  fi
}

echo "==> Helper 함수 존재 확인"
run_sql "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='auth' AND p.proname IN ('current_user_id','has_bit','resource_state','current_role_tag');" \
  | tr -d '[:space:]' | grep -q '^4$' && echo "  ✓ 4 함수 등록" || { echo "  ✗ 함수 개수 불일치"; exit 1; }

echo "==> current_user_id — 미주입 시 NULL"
got=$(run_sql "SELECT COALESCE(auth.current_user_id(), '<null>');")
expect "$got" "<null>" "SET LOCAL 없으면 NULL"

echo "==> current_user_id — 주입 시 반환"
got=$(run_sql "BEGIN; SET LOCAL app.user_id = 'alice'; SELECT auth.current_user_id(); COMMIT;")
expect "$got" "alice" "SET LOCAL app.user_id='alice'"

echo "==> has_bit — mask 미주입 시 false"
got=$(run_sql "SELECT auth.has_bit(0);")
expect "$got" "f" "app.bitmap_mask 없으면 false"

echo "==> has_bit — bit 0 set (0x01)"
got=$(run_sql "BEGIN; SET LOCAL app.bitmap_mask = '01'; SELECT auth.has_bit(0); COMMIT;")
expect "$got" "t" "0x01 에서 bit 0 는 set"

echo "==> has_bit — bit 1 unset in 0x01"
got=$(run_sql "BEGIN; SET LOCAL app.bitmap_mask = '01'; SELECT auth.has_bit(1); COMMIT;")
expect "$got" "f" "0x01 에서 bit 1 은 unset"

echo "==> has_bit — bit 3 set in 0x08 (=bit 3)"
got=$(run_sql "BEGIN; SET LOCAL app.bitmap_mask = '08'; SELECT auth.has_bit(3); COMMIT;")
expect "$got" "t" "0x08 에서 bit 3 은 set"

echo "==> has_bit — bit 8 set in 0x0001 (두번째 byte 의 0번째 bit)"
got=$(run_sql "BEGIN; SET LOCAL app.bitmap_mask = '0001'; SELECT auth.has_bit(8); COMMIT;")
expect "$got" "t" "0x0001 에서 bit 8 (두번째 byte.bit0) 은 set"

echo "==> has_bit — 범위 초과 pos 는 false"
got=$(run_sql "BEGIN; SET LOCAL app.bitmap_mask = '01'; SELECT auth.has_bit(100); COMMIT;")
expect "$got" "f" "mask 범위 초과 시 false"

echo "==> has_bit — 잘못된 hex 는 false (예외 처리)"
got=$(run_sql "BEGIN; SET LOCAL app.bitmap_mask = 'zz'; SELECT auth.has_bit(0); COMMIT;")
expect "$got" "f" "잘못된 hex 는 default deny"

echo "==> resource_state — 미존재 리소스는 NULL"
got=$(run_sql "SELECT COALESCE(auth.resource_state('non-existent-rid'), '<null>');")
expect "$got" "<null>" "미존재 rid 는 NULL"

echo "==> current_role_tag — 미주입 시 NULL"
got=$(run_sql "SELECT COALESCE(auth.current_role_tag(), '<null>');")
expect "$got" "<null>" "SET LOCAL app.role 없으면 NULL"

echo "==> current_role_tag — admin 주입"
got=$(run_sql "BEGIN; SET LOCAL app.role = 'admin'; SELECT auth.current_role_tag(); COMMIT;")
expect "$got" "admin" "SET LOCAL app.role='admin'"

echo "==> auth_app EXECUTE grant 확인"
got=$(run_sql "SELECT has_function_privilege('auth_app', 'auth.has_bit(integer)', 'EXECUTE');")
expect "$got" "t" "auth_app 이 has_bit EXECUTE 권한 보유"

echo "✓ RLS helpers smoke 통과 (13 assertion)"
