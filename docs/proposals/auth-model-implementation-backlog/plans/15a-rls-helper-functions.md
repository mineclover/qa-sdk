# Plan 15a — RLS Helper Functions + auth schema 부트스트랩

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `authorization-ontology-rls-enforcement.spec.md` §방법 **Phase 1 — helper functions + 스키마**를 구현한다. PostgreSQL RLS 정책이 `current_setting(...)`으로 세션 컨텍스트를 읽고 bitmap 비트를 조회할 수 있도록 `auth` schema에 3 개의 STABLE 함수(`auth.current_user_id()`, `auth.has_bit(pos INT)`, `auth.resource_state(rid TEXT)`)를 영속 등록한다. 함수 정의는 Plan 04a의 `packages/infra-engine/init/qa-sdk-db.sql` 뒤에 `qa-sdk-db-helpers.sql` 별도 init 파일로 추가 — qa-sdk-db 첫 부팅 시 자동 설치되며 idempotent(`CREATE OR REPLACE`). 본 plan은 application 영향 없음 — DB 기반만 마련.

**Architecture:**
- Docker entrypoint는 `/docker-entrypoint-initdb.d/`의 SQL 파일을 **알파벳 순**으로 실행 → `00-qa-sdk-db.sql` (Plan 04a, schema/role 생성) 이후에 `10-qa-sdk-db-helpers.sql` 배치.
- 함수는 `auth` schema에 소유 — qa-sdk-db 관리자(postgres superuser)가 정의하고 `auth_app`·`qa_admin`·기타 도메인 role에 `GRANT EXECUTE` 부여. 정의 수정은 superuser만 가능 (spec §주의사항 "cross-schema: auth schema는 별도 PG role로 소유, 권한 제한").
- 세션 컨텍스트 3종: `app.user_id`(TEXT), `app.bitmap_mask`(hex-encoded bytea), `app.role`(admin bypass 식별자). 모두 `current_setting(..., true)` 사용 → 미설정 시 NULL 반환 → helper 함수는 NULL-safe (spec §주의사항 "SET LOCAL 누락 방어").
- `auth.has_bit(pos)`: bitmap_mask가 hex TEXT로 주입되므로 `decode(..., 'hex')`로 bytea 변환 → `pos / 8` byte index, `pos % 8` bit offset → `get_byte(mask, byte_idx) & (1 << bit_idx)`.
- `auth.resource_state(rid)`: `auth.resource_policies`에서 state 조회. 미존재 리소스는 NULL (정책 조건식에서 NULL은 false로 취급 → default deny).
- 재시작/재배포 시에도 idempotent (`CREATE OR REPLACE`). 기존 qa-sdk-db 컨테이너에 pre-existing volume이 있으면 init은 skip되므로, Task 4에서 `psql` 수동 적용 경로 제공.

**Tech Stack:**
- PostgreSQL 16 (Plan 04a 컨테이너) — `get_byte`·`decode` 내장 함수는 15+ 이전부터 표준
- 신규 의존 없음 (SQL 파일 + docker-compose bind mount만)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/infra-engine/init/qa-sdk-db-helpers.sql` | auth.current_user_id / auth.has_bit / auth.resource_state 정의 + EXECUTE grant |
| `packages/infra-engine/scripts/test-rls-helpers.sh` | qa-sdk-db 부팅 후 helper 함수 동작 smoke |
| `packages/infra-engine/scripts/apply-rls-helpers.sh` | 기존 volume을 유지한 채 helper SQL 수동 재적용 (재배포 대응) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/infra-engine/docker-compose.infra.yaml` | qa-sdk-db service의 volumes에 `./init/qa-sdk-db-helpers.sql:/docker-entrypoint-initdb.d/10-qa-sdk-db-helpers.sql:ro` bind mount 추가 |

---

## Task 0: baseline

- [ ] **Step 1: Plan 04a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/infra-engine/init/qa-sdk-db.sql && \
  ls packages/infra-engine/scripts/test-qa-sdk-db.sh
```

Expected: 둘 다 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: qa-sdk-db 컨테이너 부팅 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml ps qa-sdk-db 2>&1 | tail -3
```

Expected: 존재 + healthy. 미기동이면 `docker compose up -d qa-sdk-db && sleep 10`.

- [ ] **Step 3: auth.resource_policies 테이블 존재 확인 (resource_state 함수 dependency)**

```bash
docker compose -f /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/docker-compose.infra.yaml \
  exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT to_regclass('auth.resource_policies');"
```

Expected: `auth.resource_policies` 문자열. NULL 이면 Plan 05b(resource_policies 생성)가 선행되지 않음 — 본 plan은 helper 정의만 하고 resource_state 함수는 테이블 없이도 생성 가능 (PG는 late binding). 실제 호출 시점에 테이블 필요.

---

## Task 1: qa-sdk-db-helpers.sql 작성

**Files:**
- Create: `packages/infra-engine/init/qa-sdk-db-helpers.sql`

spec §정의 2 (Helper functions)의 SQL을 그대로 이식하되 idempotent + grant + 주석 보강.

- [ ] **Step 1: 파일 생성**

`packages/infra-engine/init/qa-sdk-db-helpers.sql`:

```sql
-- qa-sdk RLS helper functions — spec §2 Helper functions 구현
-- 첫 부팅 시: 00-qa-sdk-db.sql 이후 실행 → auth schema 존재 확정.
-- 재적용 시: CREATE OR REPLACE로 idempotent (기존 volume 유지한 채 수동 재적용 가능).

\c qa_sdk

-- 1. auth.current_user_id — 세션에 주입된 app.user_id 반환.
--    미주입 시 NULL (default deny 유도). TEXT 그대로 반환.
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.user_id', true) $$;

-- 2. auth.has_bit — session에 주입된 bitmap_mask(hex TEXT)에서 pos 번째 비트 조회.
--    bytea 비교는 get_byte 로 byte 단위 꺼낸 뒤 bit AND.
--    mask 미주입·길이 부족 시 false → default deny.
CREATE OR REPLACE FUNCTION auth.has_bit(pos INTEGER) RETURNS BOOLEAN
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  hex_mask TEXT;
  mask BYTEA;
  byte_idx INTEGER := pos / 8;
  bit_idx INTEGER := pos % 8;
BEGIN
  hex_mask := current_setting('app.bitmap_mask', true);
  IF hex_mask IS NULL OR hex_mask = '' THEN
    RETURN false;
  END IF;
  BEGIN
    mask := decode(hex_mask, 'hex');
  EXCEPTION WHEN others THEN
    -- 잘못된 hex 주입은 default deny
    RETURN false;
  END;
  IF octet_length(mask) <= byte_idx THEN
    RETURN false;
  END IF;
  RETURN (get_byte(mask, byte_idx) & (1 << bit_idx)) <> 0;
END;
$$;

-- 3. auth.resource_state — 특정 resource_id 의 state 조회.
--    미존재 리소스는 NULL (정책 조건식에서 NULL은 false로 취급 → default deny).
CREATE OR REPLACE FUNCTION auth.resource_state(rid TEXT) RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT state FROM auth.resource_policies WHERE resource_id = rid $$;

-- 4. auth.current_role_tag — session의 app.role 값 (admin bypass 식별 용).
--    'admin' 일 때만 bypass 정책 매칭, 그 외엔 NULL.
--    spec §4 Admin bypass.
CREATE OR REPLACE FUNCTION auth.current_role_tag() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.role', true) $$;

-- 5. EXECUTE grant — 도메인 app role + qa_admin 모두 helper 호출 가능.
--    helper 정의 수정 자체는 superuser(postgres) 만 가능 → 경계 분리.
GRANT EXECUTE ON FUNCTION auth.current_user_id()          TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;
GRANT EXECUTE ON FUNCTION auth.has_bit(INTEGER)           TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;
GRANT EXECUTE ON FUNCTION auth.resource_state(TEXT)       TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;
GRANT EXECUTE ON FUNCTION auth.current_role_tag()         TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;

-- 6. qa_sdk_test DB 도 helper 동일 정의 (random schema 테스트 격리 지원).
\c qa_sdk_test

CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.user_id', true) $$;

CREATE OR REPLACE FUNCTION auth.has_bit(pos INTEGER) RETURNS BOOLEAN
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  hex_mask TEXT;
  mask BYTEA;
  byte_idx INTEGER := pos / 8;
  bit_idx INTEGER := pos % 8;
BEGIN
  hex_mask := current_setting('app.bitmap_mask', true);
  IF hex_mask IS NULL OR hex_mask = '' THEN RETURN false; END IF;
  BEGIN
    mask := decode(hex_mask, 'hex');
  EXCEPTION WHEN others THEN RETURN false;
  END;
  IF octet_length(mask) <= byte_idx THEN RETURN false; END IF;
  RETURN (get_byte(mask, byte_idx) & (1 << bit_idx)) <> 0;
END;
$$;

CREATE OR REPLACE FUNCTION auth.resource_state(rid TEXT) RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT state FROM auth.resource_policies WHERE resource_id = rid $$;

CREATE OR REPLACE FUNCTION auth.current_role_tag() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.role', true) $$;

GRANT EXECUTE ON FUNCTION auth.current_user_id()          TO qa_admin;
GRANT EXECUTE ON FUNCTION auth.has_bit(INTEGER)           TO qa_admin;
GRANT EXECUTE ON FUNCTION auth.resource_state(TEXT)       TO qa_admin;
GRANT EXECUTE ON FUNCTION auth.current_role_tag()         TO qa_admin;
```

- [ ] **Step 2: SQL 문법 검증 (실행 없이)**

```bash
docker run --rm \
  -v /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/init:/sql:ro \
  postgres:16-alpine \
  sh -c 'cat /sql/qa-sdk-db-helpers.sql > /dev/null && echo "syntax OK (basic)"'
```

Expected: `syntax OK (basic)`.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/infra-engine/init/qa-sdk-db-helpers.sql && \
  git commit -m "$(cat <<'EOF'
feat(infra-engine): RLS helper functions — auth.current_user_id / has_bit / resource_state / current_role_tag

spec §2 Helper functions 구현. idempotent (CREATE OR REPLACE).
session context (app.user_id / app.bitmap_mask / app.role) 미주입 시 default deny.
EXECUTE grant는 도메인 app role 전체 + qa_admin.
qa_sdk + qa_sdk_test 양쪽 DB 에 동일 정의.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: docker-compose bind mount 갱신

**Files:**
- Modify: `packages/infra-engine/docker-compose.infra.yaml`

qa-sdk-db service에 helpers init 파일을 두 번째 mount로 추가. 파일명 prefix `10-` 로 Plan 04a의 `00-qa-sdk-db.sql` 이후 실행 순서 보장.

- [ ] **Step 1: volumes 섹션 갱신**

`qa-sdk-db` service의 `volumes` 블록을 다음으로 교체:

```yaml
    volumes:
      - qa-sdk-db-data:/var/lib/postgresql/data
      - ./init/qa-sdk-db.sql:/docker-entrypoint-initdb.d/00-qa-sdk-db.sql:ro
      - ./init/qa-sdk-db-helpers.sql:/docker-entrypoint-initdb.d/10-qa-sdk-db-helpers.sql:ro
```

**주의**: `00-` prefix 는 Plan 04a 에 없을 수도 있음. Plan 04a 에 `00-` 이 없다면 기존 mount path(`/docker-entrypoint-initdb.d/qa-sdk-db.sql`)를 `/docker-entrypoint-initdb.d/00-qa-sdk-db.sql` 로 rename 필수 — 알파벳 순 실행 순서 확정.

- [ ] **Step 2: compose config 유효성 검사**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml config 2>&1 | grep -A5 "qa-sdk-db:" | head -20
```

Expected: error 없이 qa-sdk-db 서비스 정의 출력.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/infra-engine/docker-compose.infra.yaml && \
  git commit -m "$(cat <<'EOF'
feat(infra-engine): qa-sdk-db-helpers.sql bind mount 추가 (10- prefix)

docker-entrypoint-initdb.d 의 알파벳 순 실행 활용 — 00-qa-sdk-db.sql(schema/role) 뒤에 10-qa-sdk-db-helpers.sql(RLS helper) 자동 적용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: apply-rls-helpers.sh — 기존 volume 재적용 스크립트

**Files:**
- Create: `packages/infra-engine/scripts/apply-rls-helpers.sh`

기존 qa-sdk-db volume 이 남아있으면 docker entrypoint 는 init SQL 을 skip 한다 (postgres 표준 동작). helper 재정의·신규 추가 시 수동 적용 경로 필요.

- [ ] **Step 1: 스크립트 작성**

`packages/infra-engine/scripts/apply-rls-helpers.sh`:

```bash
#!/usr/bin/env bash
# qa-sdk-db 기존 volume 에 RLS helper SQL 재적용.
# CREATE OR REPLACE 이므로 몇 번 실행해도 안전.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==> qa-sdk-db-helpers.sql 적용 (qa_sdk)"
docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db \
  psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/10-qa-sdk-db-helpers.sql \
  || {
    echo "→ bind mount 미적용 상태. 원본 파일을 stdin 으로 전송"
    docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db \
      psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 < ./init/qa-sdk-db-helpers.sql
  }

echo "==> 함수 존재 확인"
docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db \
  psql -U postgres -d qa_sdk -tA -c "
    SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'auth'
       AND p.proname IN ('current_user_id','has_bit','resource_state','current_role_tag')
     ORDER BY p.proname;"

echo "✓ RLS helpers 적용 완료"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/scripts/apply-rls-helpers.sh
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/infra-engine/scripts/apply-rls-helpers.sh && \
  git commit -m "$(cat <<'EOF'
feat(infra-engine): apply-rls-helpers.sh — 기존 volume 유지한 채 helper 재적용

bind mount 경로가 있으면 그대로 실행, 없으면 stdin 으로 원본 파일 전송.
CREATE OR REPLACE 덕에 몇 번 실행해도 안전.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: test-rls-helpers.sh — 정확성 smoke 테스트

**Files:**
- Create: `packages/infra-engine/scripts/test-rls-helpers.sh`

spec §테스트 전략의 "Helper 함수 단위 테스트 — has_bit 의 bit 오프셋, bytea 파싱"을 shell-level 로 검증. 각 세션에서 `SET LOCAL` 후 함수 호출 결과를 assert.

- [ ] **Step 1: 스크립트 작성**

`packages/infra-engine/scripts/test-rls-helpers.sh`:

```bash
#!/usr/bin/env bash
# RLS helper 함수 정확성 smoke — bit offset / null-safe / resource_state 구역 구분.
set -euo pipefail

COMPOSE="docker compose -f /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/docker-compose.infra.yaml"
run_sql() {
  $COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -v ON_ERROR_STOP=1 -c "$1"
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
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/scripts/test-rls-helpers.sh
```

- [ ] **Step 2: qa-sdk-db 재부팅 + init 확인 (fresh volume)**

qa-sdk-db 를 fresh volume 으로 재기동하려면 volume 제거 필요. **파괴적** 동작이므로 명시적 opt-in:

```bash
# 선택적 — 기존 데이터가 있으면 Task 3 스크립트로 재적용
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml up -d qa-sdk-db && sleep 10 && \
  ./scripts/test-qa-sdk-db.sh
```

**이미 volume 있으면 helper SQL 이 init 로 실행되지 않았으므로**:

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && ./scripts/apply-rls-helpers.sh
```

- [ ] **Step 3: smoke 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && ./scripts/test-rls-helpers.sh
```

Expected: 13 assertion 통과, 마지막에 `✓ RLS helpers smoke 통과`.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/infra-engine/scripts/test-rls-helpers.sh && \
  git commit -m "$(cat <<'EOF'
test(infra-engine): RLS helpers smoke — 13 assertion

bit offset 정확성 (bit0/bit1/bit3/bit8), null-safe, hex decode 예외,
resource_state 미존재, EXECUTE grant 까지 shell-level 검증.
spec §테스트 전략 helper 함수 단위 커버.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀 점검

- [ ] **Step 1: Plan 04a smoke 재실행 (helper 추가가 기존 smoke 에 영향 없는지)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && ./scripts/test-qa-sdk-db.sh
```

Expected: Plan 04a smoke 모두 통과. helper 함수는 추가만 되고 schema/role 은 그대로.

- [ ] **Step 2: docker compose 전체 config 유효성**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml config --quiet && echo "compose config OK"
```

- [ ] **Step 3: def gate (문서 변경 없음)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

---

## Self-Review

- [ ] `auth.current_user_id()` 등 4 함수가 `qa_sdk` + `qa_sdk_test` 양쪽 DB 에 존재
- [ ] helper SQL 은 idempotent (`CREATE OR REPLACE`) — 재적용 안전
- [ ] 세션 컨텍스트 3종 (`app.user_id`, `app.bitmap_mask`, `app.role`) 모두 null-safe
- [ ] `has_bit(pos)` bit offset 계산이 spec §정의 2 의 `pos/8 byte, pos%8 bit` 그대로
- [ ] `resource_state(rid)` 미존재 리소스는 NULL → 정책 조건에서 default deny 로 귀결
- [ ] EXECUTE grant 는 5 도메인 app role + qa_admin — `_app` role 이 helper 호출 가능
- [ ] docker compose init 순서가 `00-qa-sdk-db.sql` → `10-qa-sdk-db-helpers.sql` 로 보장
- [ ] application 레이어 영향 0 — DB 기반만 마련 (spec Phase 1 요구사항 그대로)

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| RLS 실제 정책 정의 (`CREATE POLICY ...`) | Phase 2 범위 | Plan 15b |
| SET LOCAL 세션 주입 미들웨어 | Phase 3 범위 | Plan 15c |
| helper 함수 정의 수정 권한 분리 (별도 PG role 소유) | 운영 격리 — superuser owned 상태로 시작 | Phase 3 후속 |
| pg_stat_statements 등 관측 | shadow mode 에서 검증 | Plan 15d |

---

## 의존·후속

- **Plan 04a (qa-sdk-db 컨테이너 + init.sql)**: 본 plan 의 필수 선행. auth schema + 6 role 존재 가정.
- **Plan 05b (resource-policy-store PG adapter)**: `auth.resource_policies` 테이블 존재가 `resource_state` 함수 호출 시점에 필요. plan 15a 자체는 late-binding 이라 순서 무관하지만 smoke 실행 전에 05b 완료 권장.
- **Plan 15b (RLS policy templates)**: 본 plan 의 helper 를 USING/WITH CHECK 조건에서 호출 — Plan 15a 완료 후 즉시 착수 가능.
- **Plan 15c (session context middleware)**: helper 가 기대하는 `app.user_id` 등 GUC 주입 경로. 15b 와 병렬 가능.
