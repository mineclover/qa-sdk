# Plan 09b — qa-sdk-db `sim` schema + SERVICE_PORTS 9 entry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 04a로 부팅되는 `qa-sdk-db` 컨테이너의 `init.sql`에 시뮬 도메인 schema·role·grant를 추가 갱신 (qa_sdk + qa_sdk_test 양쪽). 시뮬 9개 서비스의 포트를 `@qa-sdk/core`의 `SERVICE_PORTS`에 등록 + `infra-port-allocation.spec.md`에 시뮬 섹션 추가. `.env.docker`에 `QA_SDK_SIM_PASSWORD` 신규 변수.

**Architecture:**
- DB 격리: 단일 `sim` schema 안에 도메인별 테이블 prefix (`pm_project`, `approval_budget_request` 등). qa-sdk 본체 5 schema와 분리, 6번째 schema 추가.
- Role: 단일 `sim_app` (시뮬 9개 서비스가 공유). 도메인별 분리는 시뮬 검증 가치 없음 — 권한 검증은 application-level (AccessChecker)에서 이미 한다.
- SERVICE_PORTS는 dependency-free 상수 — 9 entry 추가는 import 측 typecheck만 영향.
- Plan 04a의 init.sql과 동일 파일을 갱신: postgres 컨테이너 첫 부팅 시 자동 실행. 이미 부팅된 환경에서는 수동 마이그레이션 필요 (Defer 표 참조).

**Tech Stack:**
- postgres:16-alpine (Plan 04a와 동일)
- psql `\getenv` (PG 14+)
- TypeScript ES2023 (SERVICE_PORTS)
- 신규 npm 의존 없음

---

## File Structure

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/infra-engine/init/qa-sdk-db.sql` | `\getenv qa_sim_pw` 추가 + qa_sdk/qa_sdk_test 양쪽에 `CREATE SCHEMA sim` + `CREATE ROLE sim_app` + GRANT |
| `packages/infra-engine/docker-compose.infra.yaml` | `qa-sdk-db` service environment에 `QA_SDK_SIM_PASSWORD` 추가 |
| `packages/infra-engine/.env.docker` | `QA_SDK_SIM_PASSWORD` 신규 변수 (sops 재암호화) |
| `packages/core/src/lib/service-ports.ts` | `SERVICE_PORTS`에 sim-* 9 entry 추가 (시뮬 섹션 신설) |
| `docs/specs/infra-engine/infra-port-allocation.spec.md` | 포트 테이블에 Sim 섹션 + 9 row 추가 |

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/infra-engine/scripts/test-qa-sdk-sim-schema.sh` | sim schema/role 생성 검증 smoke 스크립트 (Plan 04a의 `test-qa-sdk-db.sh`와 자매) |

---

## Task 0: baseline 검증

- [ ] **Step 1: Plan 04a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && ls packages/infra-engine/init/qa-sdk-db.sql && grep -c "CREATE SCHEMA" packages/infra-engine/init/qa-sdk-db.sql
```

Expected: 파일 존재 + `CREATE SCHEMA` 10건 이상 (5 schema × qa_sdk + qa_sdk_test). 없으면 Plan 04a 선행 필요.

- [ ] **Step 2: Plan 04b 완료 확인 (zitadel-postgres + qa-sdk-postgres 등록)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -E "(zitadel-postgres|qa-sdk-postgres)" packages/core/src/lib/service-ports.ts
```

Expected: 두 entry hit. 없으면 Plan 04b 선행 필요.

- [ ] **Step 3: 시뮬 포트 미사용 확인 (4400~4900, 5100, 5200, 8888)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -E "44[0-9]{2}|45[0-9]{2}|46[0-9]{2}|47[0-9]{2}|48[0-9]{2}|49[0-9]{2}|5100|5200|8888" packages/core/src/lib/service-ports.ts
```

Expected: 4200(auth), 4300(payment), 4100(shopping-backend) 정도만 hit. 4400/4500/4600/4700/4800/4900/5100/5200/8888 모두 미사용 — 본 plan으로 등록 안전.

- [ ] **Step 4: qa-sdk-db 컨테이너 현재 상태 확인 (이미 부팅 중인지)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml ps qa-sdk-db 2>&1 | tail -5
```

기록: 컨테이너가 이미 healthy 상태이면 init.sql 갱신은 **새 부팅에만 적용**. 기존 컨테이너에는 Task 4의 수동 마이그레이션이 필요 — Defer 표 참조.

---

## Task 1: init.sql 갱신 — `sim` schema + `sim_app` role 추가

**Files:**
- Modify: `packages/infra-engine/init/qa-sdk-db.sql`

Plan 04a가 만든 5 schema 패턴을 그대로 따라 6번째 schema (sim) 추가.

- [ ] **Step 1: `\getenv qa_sim_pw` 라인 추가 (파일 상단)**

`packages/infra-engine/init/qa-sdk-db.sql` 상단의 `\getenv` 블록 마지막에 추가:

```sql
\getenv qa_sim_pw        QA_SDK_SIM_PASSWORD
```

전체 `\getenv` 블록은 7행이 됨:

```sql
\getenv qa_auth_pw       QA_SDK_AUTH_PASSWORD
\getenv qa_audit_pw      QA_SDK_AUDIT_PASSWORD
\getenv qa_ingest_pw     QA_SDK_INGEST_PASSWORD
\getenv qa_decision_pw   QA_SDK_DECISION_PASSWORD
\getenv qa_definition_pw QA_SDK_DEFINITION_PASSWORD
\getenv qa_admin_pw      QA_SDK_ADMIN_PASSWORD
\getenv qa_sim_pw        QA_SDK_SIM_PASSWORD
```

- [ ] **Step 2: qa_sdk DB 블록에 `sim` schema + role 추가**

`\c qa_sdk` 다음의 `CREATE SCHEMA definition;` 이후 + `CREATE ROLE qa_admin ...` 이전에 추가:

```sql
-- 시뮬레이션 schema (Plan 09b — Phase 4 enterprise-pm)
CREATE SCHEMA sim;
```

`CREATE ROLE qa_admin ...` 다음에 추가:

```sql
-- 시뮬 application role (9개 NestJS 서비스가 공유)
-- 도메인별 분리는 시뮬 검증 가치 없음 — 권한 검증은 application-level AccessChecker로 한다
CREATE ROLE sim_app WITH LOGIN PASSWORD :'qa_sim_pw';
```

GRANT 블록에 추가 (`GRANT USAGE ON SCHEMA definition TO definition_app;` 다음):

```sql
GRANT USAGE ON SCHEMA sim TO sim_app;
```

`GRANT USAGE ON SCHEMA auth, audit, ingest, decision, definition TO qa_admin;` 행을 다음으로 교체 (sim 추가):

```sql
GRANT USAGE ON SCHEMA auth, audit, ingest, decision, definition, sim TO qa_admin;
```

`ALTER DEFAULT PRIVILEGES` 블록에 추가 (`...definition GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO definition_app;` 다음):

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA sim GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sim_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sim GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sim_app;
```

`ALTER DEFAULT PRIVILEGES IN SCHEMA auth, audit, ingest, decision, definition GRANT SELECT ON TABLES TO qa_admin;` 행을 다음으로 교체 (sim 포함):

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA auth, audit, ingest, decision, definition, sim GRANT SELECT ON TABLES TO qa_admin;
```

**근거 — SEQUENCE GRANT**: 시뮬 도메인의 `id` 컬럼이 `BIGSERIAL` 또는 `IDENTITY`를 사용할 가능성 → sim_app이 sequence nextval 권한 필요. 본체 5 schema는 Plan 04a 기준 SEQUENCE GRANT가 없는데, 시뮬은 도메인이 더 직관적이라 sequence 사용 가능성 높음 → sim 한정해서 추가.

- [ ] **Step 3: qa_sdk_test DB 블록에 `sim` schema 추가**

`\c qa_sdk_test` 다음의 `CREATE SCHEMA definition;` 이후에 추가:

```sql
CREATE SCHEMA sim;
```

`GRANT ALL ON SCHEMA auth, audit, ingest, decision, definition TO qa_admin;` 행을 다음으로 교체:

```sql
GRANT ALL ON SCHEMA auth, audit, ingest, decision, definition, sim TO qa_admin;
```

- [ ] **Step 4: 갱신 후 init.sql 전체 검증 (psql syntax check)**

```bash
docker run --rm -v /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/init:/sql:ro postgres:16-alpine \
  sh -c "cat /sql/qa-sdk-db.sql > /dev/null && echo 'syntax read OK'"
```

Expected: `syntax read OK`. 완전한 lint는 Task 4의 부팅 검증에서 수행.

- [ ] **Step 5: grep으로 변경 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -E "(sim_app|SCHEMA sim|qa_sim_pw)" packages/infra-engine/init/qa-sdk-db.sql
```

Expected: `qa_sim_pw` (1건), `CREATE SCHEMA sim` (2건 — qa_sdk + qa_sdk_test), `sim_app` (3건 — CREATE ROLE + 2 GRANT), 그리고 `auth, audit, ingest, decision, definition, sim` 패턴이 4건 (qa_sdk의 USAGE/DEFAULT + qa_sdk_test의 ALL).

---

## Task 2: docker-compose.infra.yaml 갱신

**Files:**
- Modify: `packages/infra-engine/docker-compose.infra.yaml`

`qa-sdk-db` service의 `environment` 블록에 `QA_SDK_SIM_PASSWORD` 추가.

- [ ] **Step 1: environment 블록 갱신**

`packages/infra-engine/docker-compose.infra.yaml`의 `qa-sdk-db.environment` 블록 마지막 줄 (`QA_SDK_ADMIN_PASSWORD: ...`) 다음에 추가:

```yaml
      QA_SDK_SIM_PASSWORD: ${QA_SDK_SIM_PASSWORD}
```

전체 environment 블록 (7개 PASSWORD):

```yaml
    environment:
      POSTGRES_DB: postgres
      QA_SDK_AUTH_PASSWORD: ${QA_SDK_AUTH_PASSWORD}
      QA_SDK_AUDIT_PASSWORD: ${QA_SDK_AUDIT_PASSWORD}
      QA_SDK_INGEST_PASSWORD: ${QA_SDK_INGEST_PASSWORD}
      QA_SDK_DECISION_PASSWORD: ${QA_SDK_DECISION_PASSWORD}
      QA_SDK_DEFINITION_PASSWORD: ${QA_SDK_DEFINITION_PASSWORD}
      QA_SDK_ADMIN_PASSWORD: ${QA_SDK_ADMIN_PASSWORD}
      QA_SDK_SIM_PASSWORD: ${QA_SDK_SIM_PASSWORD}
```

- [ ] **Step 2: docker-compose 문법 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml config 2>&1 | grep -A1 QA_SDK_SIM_PASSWORD | head -5
```

Expected: `QA_SDK_SIM_PASSWORD` 환경 변수 hit. 에러 없음.

만약 `WARN[0000] The "QA_SDK_SIM_PASSWORD" variable is not set` 경고 → Task 3에서 `.env.docker`에 추가하면 사라짐.

---

## Task 3: `.env.docker`에 `QA_SDK_SIM_PASSWORD` 추가

**Files:**
- Modify: `packages/infra-engine/.env.docker`

`.env.docker`는 sops 암호화 가능. Plan 04a Task 3과 동일 절차.

- [ ] **Step 1: 현재 형식 파악 (평문 vs sops)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && head -3 .env.docker
```

Expected:
- 평문: `QA_SDK_AUTH_PASSWORD=...` 등 환경변수 직접 노출
- sops: `sops:` YAML 메타데이터 헤더 또는 base64 노이즈

- [ ] **Step 2-A: 평문일 경우 직접 추가**

```bash
QA_SIM_PW="$(openssl rand -base64 24 | tr -d '\n')"
echo "QA_SDK_SIM_PASSWORD=${QA_SIM_PW}" >> /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker
```

- [ ] **Step 2-B: sops일 경우 복호화 → 편집 → 재암호화**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && sops decrypt .env.docker > /tmp/qa-env-decrypted.txt
QA_SIM_PW="$(openssl rand -base64 24 | tr -d '\n')"
echo "QA_SDK_SIM_PASSWORD=${QA_SIM_PW}" >> /tmp/qa-env-decrypted.txt
sops encrypt /tmp/qa-env-decrypted.txt > .env.docker
shred -u /tmp/qa-env-decrypted.txt   # macOS는 srm 또는 rm + dd random
```

- [ ] **Step 3: .gitignore 점검**

`packages/infra-engine/.gitignore`에 `.env.docker` 항목 확인 (Plan 04a Task 3에서 이미 추가됨):

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && grep -q "^\.env\.docker$" .gitignore && echo "OK" || echo ".env.docker" >> .gitignore
```

Expected: `OK` 출력 (이미 등록됨).

- [ ] **Step 4: docker-compose 환경 변수 주입 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml config 2>&1 | grep "QA_SDK_SIM_PASSWORD" | head -3
```

Expected: 환경변수 값이 표시 (평문 노출 위험 — 출력 후 터미널 history clear 권장). 또는 `${QA_SDK_SIM_PASSWORD}` placeholder가 그대로 보이면 .env.docker가 docker compose에 인식되지 않은 것 — `--env-file` 옵션 또는 위치 점검.

---

## Task 4: 컨테이너 재부팅 + sim schema/role 검증

**Files:**
- Create: `packages/infra-engine/scripts/test-qa-sdk-sim-schema.sh`

이미 부팅 중인 qa-sdk-db 컨테이너에는 init.sql 갱신이 자동 적용되지 않는다 (postgres 표준 동작 — `/docker-entrypoint-initdb.d/`는 첫 부팅 시에만 실행). 따라서 두 가지 시나리오:

1. **신규 환경**: volume 삭제 후 재부팅 → init.sql 전체 재실행
2. **기존 환경**: 수동 SQL 실행 (Defer 표의 마이그레이션 절차)

본 plan은 신규 환경 검증만 수행. 기존 환경은 별도 마이그레이션 스크립트 (Defer).

- [ ] **Step 1: smoke 스크립트 작성**

`packages/infra-engine/scripts/test-qa-sdk-sim-schema.sh`:

```bash
#!/usr/bin/env bash
# qa-sdk-db sim schema + sim_app role 검증 — Plan 09b 마무리
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

CONTAINER="qa-sdk-db"

echo "==> qa-sdk-db 컨테이너 healthcheck 대기"
for i in $(seq 1 12); do
  status=$(docker compose -f docker-compose.infra.yaml ps --format json $CONTAINER 2>/dev/null | jq -r '.Health' 2>/dev/null || echo "starting")
  if [[ "$status" == "healthy" ]]; then
    echo "  → healthy"
    break
  fi
  echo "  → $status (대기 ${i}/12)"
  sleep 5
done

echo "==> qa_sdk DB의 sim schema 존재 확인"
docker compose -f docker-compose.infra.yaml exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT nspname FROM pg_namespace WHERE nspname = 'sim';"

echo "==> qa_sdk_test DB의 sim schema 존재 확인"
docker compose -f docker-compose.infra.yaml exec -T $CONTAINER \
  psql -U postgres -d qa_sdk_test -tA \
  -c "SELECT nspname FROM pg_namespace WHERE nspname = 'sim';"

echo "==> sim_app role 존재 확인"
docker compose -f docker-compose.infra.yaml exec -T $CONTAINER \
  psql -U postgres -tA \
  -c "SELECT rolname FROM pg_roles WHERE rolname = 'sim_app';"

echo "==> sim_app의 sim schema USAGE 권한 확인"
docker compose -f docker-compose.infra.yaml exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT has_schema_privilege('sim_app', 'sim', 'USAGE');"

echo "==> qa_admin의 sim schema USAGE 권한 확인 (cross-domain)"
docker compose -f docker-compose.infra.yaml exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT has_schema_privilege('qa_admin', 'sim', 'USAGE');"

echo "==> 전체 schema 6개 확인 (auth/audit/ingest/decision/definition/sim)"
docker compose -f docker-compose.infra.yaml exec -T $CONTAINER \
  psql -U postgres -d qa_sdk -tA \
  -c "SELECT nspname FROM pg_namespace WHERE nspname IN ('auth','audit','ingest','decision','definition','sim') ORDER BY nspname;"

echo "✓ qa-sdk-db sim schema smoke 통과"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/scripts/test-qa-sdk-sim-schema.sh
```

- [ ] **Step 2: 신규 환경에서 검증 (volume 재생성)**

**경고**: 이 단계는 기존 qa_sdk DB 데이터를 삭제한다. 운영 데이터가 있으면 백업 또는 Defer 표의 수동 마이그레이션을 사용.

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml down qa-sdk-db && \
  docker volume rm infra-engine_qa-sdk-db-data 2>/dev/null || true && \
  docker compose -f docker-compose.infra.yaml up -d qa-sdk-db && \
  sleep 15 && \
  ./scripts/test-qa-sdk-sim-schema.sh
```

Expected output 일부:
```
sim
sim
sim_app
t
t
auth
audit
decision
definition
ingest
sim
✓ qa-sdk-db sim schema smoke 통과
```

실패 시 진단:
- `\getenv` 실패 → `.env.docker`에 `QA_SDK_SIM_PASSWORD` 누락 → Task 3 재확인
- `permission denied` → `qa_admin`이 `sim` USAGE 못 받음 → Step 1의 GRANT 라인 점검
- `sim` schema 미생성 → init.sql의 qa_sdk 블록에 `CREATE SCHEMA sim;` 누락 → Task 1 Step 2 점검

- [ ] **Step 3: sim_app으로 실제 연결 테스트**

```bash
docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db \
  psql -U postgres -d qa_sdk -c "SET ROLE sim_app; CREATE TABLE sim.test_smoke (id INT); INSERT INTO sim.test_smoke VALUES (1); SELECT * FROM sim.test_smoke; DROP TABLE sim.test_smoke;"
```

Expected:
```
SET
CREATE TABLE
INSERT 0 1
 id 
----
  1
(1 row)

DROP TABLE
```

만약 `permission denied for schema sim` → `ALTER DEFAULT PRIVILEGES`가 적용되지 않음 → init.sql 재검토.

---

## Task 5: SERVICE_PORTS에 sim-* 9 entry 추가

**Files:**
- Modify: `packages/core/src/lib/service-ports.ts`

Plan 04b가 추가한 인프라 DB 섹션 다음에 새 "시뮬레이션" 섹션 추가.

- [ ] **Step 1: SERVICE_PORTS 배열에 9 entry 추가**

`packages/core/src/lib/service-ports.ts`의 `// ── 프론트엔드 (5xxx) ──` 섹션 직전에 추가:

```ts
  // ── 시뮬레이션 — Enterprise PM (Phase 4) ──
  { name: "sim-auth-api",            defaultPort: 4400, description: "시뮬: 사용자/role/department + bitmap 발행" },
  { name: "sim-pm-api",              defaultPort: 4500, description: "시뮬: Project/Task/Member" },
  { name: "sim-approval-api",        defaultPort: 4600, description: "시뮬: Budget/Resource/Time-off/Expense workflow" },
  { name: "sim-notification-api",    defaultPort: 4700, description: "시뮬: 알림·구독" },
  { name: "sim-reporting-api",       defaultPort: 4800, description: "시뮬: 분석·대시보드 (marginal density 측정)" },
  { name: "sim-document-api",        defaultPort: 4900, description: "시뮬: 첨부파일·코멘트·버전" },
  { name: "sim-audit-browser-api",   defaultPort: 5100, description: "시뮬: audit trace explorer API" },
  { name: "sim-metrics-collector",   defaultPort: 5200, description: "시뮬: Prometheus exporter" },
  { name: "sim-gateway",             defaultPort: 8888, description: "시뮬: Hono gateway (JWT + traceparent)" },
```

전체 SERVICE_PORTS는 18 → 27 entries.

**섹션 위치 근거**: 시뮬 게이트웨이(8888)는 8xxx 게이트웨이 섹션과 겹치지만, 시뮬 그룹의 응집도가 더 중요 → 단일 시뮬 섹션으로 통합. 5100/5200은 "프론트엔드 5xxx" 섹션과 다른 성격(시뮬 인프라 audit/metrics) → 시뮬 섹션 안에 위치.

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core typecheck 2>&1 | tail -5
```

Expected: 에러 없음.

- [ ] **Step 3: SERVICE_PORTS 카운트·중복 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core build 2>&1 | tail -3 && node -e "
const { SERVICE_PORTS, detectPortConflicts } = require('./packages/core/dist/lib/service-ports.js');
console.log('total entries:', SERVICE_PORTS.length);
const ports = SERVICE_PORTS.map(e => e.defaultPort);
const dups = ports.filter((p, i) => ports.indexOf(p) !== i);
console.log('duplicates:', dups);
console.log('sim-gateway conflicts:', detectPortConflicts('test', 8888));
"
```

Expected:
```
total entries: 27
duplicates: []
sim-gateway conflicts: [ '⚠ PORT 8888 conflicts with sim-gateway ...' ]
```

만약 `duplicates`가 비어있지 않으면 → 새 entry가 기존 포트와 충돌 → 디자인 문서 §2 포트 표 재확인.

- [ ] **Step 4: 기존 service-ports 테스트 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core test -- service-ports 2>&1 | tail -5
```

Expected: 모두 통과. SSOT 원칙대로 entry 개수 hardcode가 없으면 변경 필요 없음 (Plan 04b Task 1 Step 3 참조).

만약 hardcode `expect(SERVICE_PORTS.length).toBe(18)` 발견 → 해당 expect 자체를 invariant 형태로 교체:
```ts
// before
expect(SERVICE_PORTS.length).toBe(18);
// after — SSOT 파생
expect(SERVICE_PORTS.every(e => e.defaultPort > 0 && e.name.length > 0)).toBe(true);
```

---

## Task 6: spec 문서 갱신

**Files:**
- Modify: `docs/specs/infra-engine/infra-port-allocation.spec.md`

Plan 04b Task 2 패턴 따라 시뮬 섹션 추가.

- [ ] **Step 1: 포트 테이블에 Sim 섹션 추가**

`docs/specs/infra-engine/infra-port-allocation.spec.md`의 마지막 row (`| **Debug** | gRPC debug | 50051 | ...`) 직전에 추가:

```markdown
| **Sim** | sim-auth-api | 4400 | 시뮬: 사용자/role/department + bitmap 발행 |
| **Sim** | sim-pm-api | 4500 | 시뮬: Project/Task/Member |
| **Sim** | sim-approval-api | 4600 | 시뮬: Budget/Resource/Time-off/Expense workflow |
| **Sim** | sim-notification-api | 4700 | 시뮬: 알림·구독 |
| **Sim** | sim-reporting-api | 4800 | 시뮬: 분석·대시보드 (marginal density) |
| **Sim** | sim-document-api | 4900 | 시뮬: 첨부·코멘트·버전 |
| **Sim** | sim-audit-browser-api | 5100 | 시뮬: audit trace explorer |
| **Sim** | sim-metrics-collector | 5200 | 시뮬: Prometheus exporter |
| **Sim** | sim-gateway | 8888 | 시뮬: Hono gateway (JWT + traceparent) |
| **Sim** | sim-redis | 6379 | 시뮬: bitmap pub/sub + event broadcast (`docker-compose.sim.yaml`) |
```

**주의 — `sim-redis` 추가**: Redis는 SERVICE_PORTS에 등록하지 않음 (NPM 서비스가 아닌 인프라 컨테이너). 하지만 spec 문서에는 포트 충돌 추적용으로 기록.

- [ ] **Step 2: 관리 원칙 보강 (선택)**

§관리 원칙에 시뮬 항목 한 줄 추가:

```markdown
- **시뮬레이션 격리**: `sim-*` 서비스(Phase 4 enterprise-pm)는 `simulations/enterprise-pm/docker-compose.sim.yaml`에서 부팅. 실제 비즈니스 서비스(`shopping-backend`, `auth`, `payment`)와 포트 대역 분리 (4400~ vs 4100~). 충돌 검출은 SERVICE_PORTS가 일원 처리.
```

- [ ] **Step 3: def sync로 DB 반영**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def sync 2>&1 | tail -3
```

Expected: 1 doc updated.

- [ ] **Step 4: def validate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate 2>&1 | head -5
```

Expected: errors=0 유지.

---

## Task 7: 회귀 점검

- [ ] **Step 1: core를 import하는 패키지 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^@qa-sdk/core" typecheck 2>&1 | tail -10
```

Expected: 모두 에러 없음 (entry 추가는 backward-compat).

- [ ] **Step 2: 영향 패키지 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core --filter @qa-sdk/cli test 2>&1 | tail -10
```

Expected: 통과.

- [ ] **Step 3: workflow-smoke 12건 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | grep -E "(passed|failed)" | tail -3
```

Expected: 12+ smoke 통과 유지.

- [ ] **Step 4: docker-compose 회귀 (zitadel-db + minio 영향 없음)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml config 2>&1 | tail -10
```

Expected: 전체 compose valid. 에러 없음.

---

## Self-Review

- [ ] init.sql에 `sim` schema (qa_sdk + qa_sdk_test 양쪽) + `sim_app` role + GRANT 추가
- [ ] init.sql의 `qa_admin`이 sim schema도 SELECT 가능
- [ ] `sim_app`은 SEQUENCE GRANT 포함 (BIGSERIAL/IDENTITY 호환)
- [ ] docker-compose.infra.yaml의 qa-sdk-db environment에 `QA_SDK_SIM_PASSWORD` 추가
- [ ] .env.docker에 `QA_SDK_SIM_PASSWORD` 추가 (sops 암호화 또는 .gitignore 보호)
- [ ] SERVICE_PORTS에 9 sim-* entry (시뮬 섹션 신설), 27 total
- [ ] 포트 중복 0건 (스크립트로 검증)
- [ ] infra-port-allocation.spec.md에 Sim 섹션 10 row (sim-redis 포함)
- [ ] sim_app으로 sim schema 안에서 CREATE/INSERT/SELECT/DROP 동작
- [ ] qa-sdk 본체 5 schema(auth/audit/ingest/decision/definition) 영향 없음

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan / 처리 |
|---|---|---|
| 기존 qa-sdk-db 컨테이너에 sim schema 수동 적용 | 본 plan은 신규 부팅 검증만. 운영 환경 마이그레이션은 별도 절차 | Defer 표 다음 항목의 마이그레이션 SQL 참조 |
| 시뮬 도메인 테이블 DDL (pm_project, approval_budget_request 등) | DB 모델은 도메인 스펙과 함께 추가 | Plan 11a/b/c |
| 시뮬 Drizzle schema 정의 | 도메인 모델과 동시 | Plan 11a/b/c |
| RLS 정책 (sim 테이블) | Phase 3 §3 RLS 패턴 적용 | Phase 3 결과 적용 후 시뮬 추가 plan |
| sim-redis 컨테이너 정의 | 시뮬 자체 docker-compose 책임 | Plan 09c |
| Connection pool 튜닝 | 부하 측정 후 | 시뮬 트래픽 후 |

### 기존 컨테이너 마이그레이션 SQL (참고)

운영 중인 qa-sdk-db에 sim schema를 수동 적용하려면:

```sql
-- as postgres superuser
\c qa_sdk
CREATE SCHEMA sim;
CREATE ROLE sim_app WITH LOGIN PASSWORD 'CHANGE_ME';   -- 실제 패스워드는 sops로 관리
GRANT USAGE ON SCHEMA sim TO sim_app;
GRANT USAGE ON SCHEMA sim TO qa_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA sim GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sim_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sim GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sim_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sim GRANT SELECT ON TABLES TO qa_admin;

\c qa_sdk_test
CREATE SCHEMA sim;
GRANT ALL ON SCHEMA sim TO qa_admin;
```

---

## 의존·후속

- **선행**:
  - Plan 04a (qa-sdk-db 컨테이너 + 5 schema) — init.sql이 이미 존재해야 본 plan이 갱신
  - Plan 04b (SERVICE_PORTS에 zitadel-postgres + qa-sdk-postgres) — 본 plan은 같은 SSOT에 9 entry 추가
- **병렬 가능**: Plan 09a (workspace 부트스트랩) — DB와 workspace는 직교
- **후속**:
  - Plan 09c (docker-compose.sim.yaml) — sim-* 서비스가 본 plan의 sim_app role + qa-sdk-postgres:5434를 참조
  - Plan 09d (.env.sim) — `QA_PG_USER=sim_app`, `QA_PG_SCHEMA=sim` 환경 변수 작성
  - Plan 11 (도메인 모델) — sim schema 안에 도메인별 테이블 prefix(`pm_*`, `approval_*` 등) 생성
