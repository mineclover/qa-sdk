# Plan 05d — resource-policy-store 호출자 factory 마이그레이션

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 외부 호출자가 직접 어댑터 클래스(`SqliteResourcePolicyRegistry`/`DrizzleResourcePolicyRegistry`)를 `new`로 인스턴스화하던 패턴을 Plan 05c의 `createResourcePolicyRegistry({ dialect, db })` factory 호출로 마이그레이션한다. 모든 호출자가 전환된 직후, backward-compat alias `DrizzleResourcePolicyRegistry`에 deprecation 마킹을 추가한다 (제거는 별도 plan, 본 plan은 deprecation까지).

**Architecture:**
- 호출자는 두 부류:
  1. **테스트 코드** (`*.test.ts`) — fixture 헬퍼와 factory를 함께 도입. `db-bootstrap` devDep으로 추가.
  2. **런타임 코드** — 본 plan 시점 SQLite-only 호출자만 존재 (PG 호출자는 04d/05c 종료 후 별도 plan에서). 인터페이스는 `port.ts` 통해 받음.
- 한 번에 한 호출자씩 마이그레이션 + 즉시 회귀 → 변경 격리.
- 마지막 단계에서 `DrizzleResourcePolicyRegistry` alias에 `@deprecated` JSDoc + index.ts 주석으로 deprecation 마킹. **클래스 자체 제거는 별도 plan** — 본 plan은 deprecation까지만.

**Tech Stack:**
- 기존 호출자가 사용하는 stack 그대로 (`better-sqlite3`, `drizzle-orm/better-sqlite3`)
- 신규 import: `createResourcePolicyRegistry` (resource-policy-store), `createSqliteTestFixture` (db-bootstrap, 테스트 한정)

---

## 외부 호출자 인벤토리 (Plan 05c Task 0 결과)

| 파일 | 패턴 | 마이그레이션 책임 |
|---|---|---|
| `packages/resource-policy-store/src/e2e-integration.test.ts` | `new DrizzleResourcePolicyRegistry(db)` (현재) → Plan 05a에서 `SqliteResourcePolicyRegistry` 또는 alias 그대로 | Task 1 |
| `packages/audit-recorder-store/src/e2e-integration.test.ts` | `import { DrizzleResourcePolicyRegistry } from "resource-policy-store"` + `new DrizzleResourcePolicyRegistry(db)` | Task 2 |
| `packages/permission-engine/src/access-checker/checker.ts` | 인터페이스만 사용 (`type ResourcePolicyRegistry`) — 실제 인스턴스 생성 안 함 | 변경 없음 |

**확장 검색 (잠재 호출자)** — Plan 시작 시 Task 0 Step 1에서 다시 검증:

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "new DrizzleResourcePolicyRegistry\|new SqliteResourcePolicyRegistry\|new PgResourcePolicyRegistry" packages --include="*.ts" | \
  grep -v node_modules | grep -v dist
```

새 호출자가 발견되면 Task 1·2 패턴으로 추가 task 삽입.

---

## File Structure

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/resource-policy-store/src/e2e-integration.test.ts` | `new DrizzleResourcePolicyRegistry` → `await createResourcePolicyRegistry({ dialect: "sqlite", db })`. fixture를 `createSqliteTestFixture`로 통일. |
| `packages/audit-recorder-store/src/e2e-integration.test.ts` | 동일 패턴. `audit-recorder-store`가 자체 audit DDL을 같은 SQLite 인스턴스에 추가 적용해야 하므로 fixture 헬퍼 사용 + `raw.exec(AUDIT_ENTRIES_DDL)` 단계 보존. |
| `packages/audit-recorder-store/package.json` | `db-bootstrap` devDep 추가 (없을 경우) |
| `packages/resource-policy-store/src/index.ts` | `DrizzleResourcePolicyRegistry` alias에 `@deprecated` JSDoc + 주석 |

### 변경하지 않는 파일

| 경로 | 이유 |
|---|---|
| `packages/permission-engine/src/access-checker/checker.ts` | 인터페이스 타입만 사용 — 인스턴스 생성·import 안 함. |
| `packages/resource-policy-store/src/sqlite/adapter.ts`, `pg/adapter.ts` | 어댑터 클래스 자체는 유지. factory가 내부에서 동적 로드. |
| `packages/resource-policy-store/src/factory.ts`, `port.ts` | Plan 05c 산출물 — 변경 없음. |

---

## Task 0: baseline

- [ ] **Step 1: Plan 05c 완료 확인 + 호출자 인벤토리 재확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "createResourcePolicyRegistry" packages/resource-policy-store/src/factory.ts && \
  grep -n "createResourcePolicyRegistry" packages/resource-policy-store/src/index.ts
```

Expected: 두 명령 모두 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: 호출자 인벤토리 재실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "new DrizzleResourcePolicyRegistry\|new SqliteResourcePolicyRegistry\|new PgResourcePolicyRegistry" packages --include="*.ts" | \
  grep -v node_modules | grep -v dist
```

Expected: 본 plan 시작 시점 인벤토리 (위 표 기준). 신규 호출자 발견 시 별도 Task 추가.

- [ ] **Step 3: 현재 테스트 baseline 측정**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store --filter audit-recorder-store --filter permission-engine test 2>&1 | tail -10
```

Expected: 모두 통과. 본 plan 종료 시 동일 카운트.

- [ ] **Step 4: 호출자 build dist 회귀 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store --filter audit-recorder-store --filter permission-engine build 2>&1 | tail -5
```

Expected: 빌드 0 error. 본 plan 종료 시 동일.

---

## Task 1: resource-policy-store/e2e-integration.test.ts 마이그레이션

**Files:**
- Modify: `packages/resource-policy-store/src/e2e-integration.test.ts`

현재 코드의 `setupContext()`는 직접 `new Database(":memory:")` + `raw.exec(RESOURCE_POLICIES_DDL)` + `new DrizzleResourcePolicyRegistry(db)` 3단계를 수행한다. fixture + factory 사용으로 의도를 1단계로 줄인다.

- [ ] **Step 1: 현재 setupContext 구조 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "setupContext\|new DrizzleResourcePolicyRegistry\|new Database\|RESOURCE_POLICIES_DDL\|new Database" \
  packages/resource-policy-store/src/e2e-integration.test.ts
```

Expected: import + setupContext 정의 + 호출 위치 식별. fixture 적용 위치 사전 검토.

- [ ] **Step 2: import 블록 수정**

`packages/resource-policy-store/src/e2e-integration.test.ts` 상단 import 블록을 다음으로 교체:

```ts
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DisjointUnionIndex, buildMask } from "weighted-index";

import {
  AccessChecker,
  InMemoryAuditRecorder,
  issueBitmap,
  type InstancePolicyEvaluator,
} from "permission-engine";

import { createSqliteTestFixture } from "db-bootstrap";

import { createResourcePolicyRegistry } from "./factory.js";
import { type ResourcePolicyRegistry } from "./port.js";
import { RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";
```

제거: `import Database from "better-sqlite3"`, `import { drizzle } from "drizzle-orm/better-sqlite3"`, `import { DrizzleResourcePolicyRegistry } from "./drizzle-registry.js"`, `import { RESOURCE_POLICIES_DDL } from "./schema.js"`.

- [ ] **Step 3: setupContext를 async fixture 기반으로 수정**

기존 `setupContext()` 함수를 다음으로 교체:

```ts
async function setupContext() {
  const fixture = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
  const registry: ResourcePolicyRegistry = await createResourcePolicyRegistry({
    dialect: "sqlite",
    db: fixture.db as never,
  });
  const audit = new InMemoryAuditRecorder();
  const secret = randomBytes(32);
  let spanCounter = 0;
  const newSpanId = () => `span-${++spanCounter}`;
  return {
    registry,
    audit,
    secret,
    newSpanId,
    cleanup: fixture.cleanup,
  };
}
```

호출자 시그니처 변경: `setupContext()` → `await setupContext()`. 모든 it 블록의 `const { ... } = setupContext();` → `const { ... } = await setupContext();` + `try`/`finally`로 cleanup 호출.

- [ ] **Step 4: it 블록 1번 — "풀 시나리오" 마이그레이션**

```ts
it("풀 시나리오 — 8단계 통합 플로우 (audit tree + replay 포함)", async () => {
  const ctx = await setupContext();
  try {
    const { registry, audit, secret, newSpanId } = ctx;
    // ... 기존 본문 그대로 ...
  } finally {
    await ctx.cleanup();
  }
});
```

- [ ] **Step 5: it 블록 2번 — "VersionedBitmap 변조 검증" 마이그레이션**

```ts
it("VersionedBitmap 변조 검증 — HMAC 서명 불일치", async () => {
  const ctx = await setupContext();
  try {
    const { secret } = ctx;
    // ... 기존 본문 그대로 ...
  } finally {
    await ctx.cleanup();
  }
});
```

- [ ] **Step 6: it 블록 3번 — "Cross-kind disjoint" 마이그레이션 검토**

기존 코드에서 이 블록은 `setupContext()`를 호출하지 않는다 (DisjointUnionIndex만 사용). 변경 없음.

- [ ] **Step 7: typecheck + 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store typecheck && \
  pnpm --filter resource-policy-store test -- e2e-integration
```

Expected: 3 PASS (기존 카운트 동일). 어떤 test도 fail 시 마이그레이션 step 누락 — 즉시 수정.

- [ ] **Step 8: 다른 resource-policy-store 테스트 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store test 2>&1 | tail -10
```

Expected: SQLite + factory + port + port-contract + e2e 모두 통과.

- [ ] **Step 9: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/e2e-integration.test.ts && \
  git commit -m "$(cat <<'EOF'
refactor(resource-policy-store): e2e-integration — factory + fixture 마이그레이션

직접 new Database/new DrizzleResourcePolicyRegistry 3단계를
createSqliteTestFixture + createResourcePolicyRegistry 1단계로 정리.
cleanup을 try/finally로 명시 — 누수 0.
시나리오·검증 본문 변경 없음.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: audit-recorder-store/e2e-integration.test.ts 마이그레이션

**Files:**
- Modify: `packages/audit-recorder-store/package.json` (db-bootstrap devDep 없으면 추가)
- Modify: `packages/audit-recorder-store/src/e2e-integration.test.ts`

이 테스트는 같은 SQLite 인스턴스에 **두 DDL**을 적용한다 (resource-policies + audit-entries). `createSqliteTestFixture`는 단일 DDL 인자만 받으므로 두 DDL을 concat 해서 전달한다.

- [ ] **Step 1: db-bootstrap devDep 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "db-bootstrap" packages/audit-recorder-store/package.json
```

Expected: 없으면 Step 2 수행. 있으면 Step 2 건너뜀.

- [ ] **Step 2: package.json devDep 추가 (필요 시)**

`packages/audit-recorder-store/package.json`의 `devDependencies`에 추가:

```json
{
  "devDependencies": {
    "db-bootstrap": "workspace:*",
    // ... 기존 dev deps ...
  }
}
```

추가 후:

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 3: 현재 setup() 구조 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "function setup\|new DrizzleResourcePolicyRegistry\|new DrizzleAuditRecorder\|raw.exec" \
  packages/audit-recorder-store/src/e2e-integration.test.ts
```

- [ ] **Step 4: import 블록 수정**

`packages/audit-recorder-store/src/e2e-integration.test.ts` 상단:

```ts
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DisjointUnionIndex, buildMask } from "weighted-index";

import {
  AccessChecker,
  issueBitmap,
  type InstancePolicyEvaluator,
} from "permission-engine";

import {
  RESOURCE_POLICIES_DDL,
  createResourcePolicyRegistry,
} from "resource-policy-store";

import { createSqliteTestFixture } from "db-bootstrap";

import { DrizzleAuditRecorder } from "./drizzle-recorder.js";
import { AUDIT_ENTRIES_DDL } from "./schema.js";
```

제거: `import Database from "better-sqlite3"`, `import { drizzle } from "drizzle-orm/better-sqlite3"`, `import { DrizzleResourcePolicyRegistry, RESOURCE_POLICIES_DDL } from "resource-policy-store"` (재구성).

- [ ] **Step 5: setup() 함수를 fixture + factory 기반으로 수정**

```ts
async function setup() {
  // 두 store가 같은 SQLite 인스턴스를 공유 — DDL을 concat
  const COMBINED_DDL = `${RESOURCE_POLICIES_DDL}\n${AUDIT_ENTRIES_DDL}`;
  const fixture = await createSqliteTestFixture(COMBINED_DDL);
  const registry = await createResourcePolicyRegistry({
    dialect: "sqlite",
    db: fixture.db as never,
  });
  // DrizzleAuditRecorder는 본 패키지의 직접 클래스 — factory 미적용 (별도 plan).
  const audit = new DrizzleAuditRecorder(fixture.db as never);
  const secret = randomBytes(32);
  let n = 0;
  const newSpanId = () => `span-${++n}`;
  return {
    registry,
    audit,
    secret,
    newSpanId,
    cleanup: fixture.cleanup,
  };
}
```

주의: `DrizzleAuditRecorder`도 같은 fixture.db를 받음. SQLite 인스턴스 1개에 두 어댑터 attach — 기존 동작 유지.

- [ ] **Step 6: 두 it 블록 마이그레이션 — try/finally cleanup**

각 it 블록을 다음 패턴으로 수정:

```ts
it("...", async () => {
  const ctx = await setup();
  try {
    const { registry, audit, secret, newSpanId } = ctx;
    // ... 기존 본문 그대로 ...
  } finally {
    await ctx.cleanup();
  }
});
```

- [ ] **Step 7: typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter audit-recorder-store typecheck && \
  pnpm --filter audit-recorder-store test -- e2e-integration
```

Expected: 2 PASS (기존 카운트 동일). 어떤 test도 fail 시 마이그레이션 step 누락 — 즉시 수정.

- [ ] **Step 8: audit-recorder-store 전체 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter audit-recorder-store test 2>&1 | tail -10
```

Expected: 모든 테스트 통과.

- [ ] **Step 9: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/audit-recorder-store/package.json packages/audit-recorder-store/src/e2e-integration.test.ts pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
refactor(audit-recorder-store): e2e-integration — factory + fixture 마이그레이션

resource-policy 어댑터 부분을 createResourcePolicyRegistry로 전환.
audit + resource-policies DDL을 단일 fixture에 concat — SQLite 인스턴스 1개 공유 패턴 유지.
DrizzleAuditRecorder factory화는 Plan 06 (audit-recorder-store dual-target).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 잔여 호출자 회귀 검증 + 추가 호출자 처리

- [ ] **Step 1: 모든 호출자 마이그레이션 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "new DrizzleResourcePolicyRegistry\|new SqliteResourcePolicyRegistry\|new PgResourcePolicyRegistry" packages --include="*.ts" | \
  grep -v node_modules | grep -v dist | grep -v "resource-policy-store/src/sqlite/adapter\|resource-policy-store/src/pg/adapter"
```

Expected: 0 hit (어댑터 자체 정의 파일만 제외). 1+ hit 발견 시:

1. 해당 호출자를 식별하고 Task 1·2 패턴으로 추가 마이그레이션 task 삽입
2. 수정 후 재실행

- [ ] **Step 2: import 패턴 호출자 추가 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "DrizzleResourcePolicyRegistry" packages --include="*.ts" | \
  grep -v node_modules | grep -v dist | grep -v "resource-policy-store/src"
```

Expected: 0 hit. `DrizzleResourcePolicyRegistry` 이름은 더 이상 외부 호출자 코드에 등장하지 않음.

- [ ] **Step 3: 의존자 typecheck 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter "...^resource-policy-store" typecheck 2>&1 | tail -10
```

Expected: 에러 없음.

- [ ] **Step 4: workspace 전체 빌드 회귀 (호출자 dist 영향 0 확인)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store --filter audit-recorder-store --filter permission-engine build 2>&1 | tail -5
```

Expected: 빌드 0 error.

---

## Task 4: DrizzleResourcePolicyRegistry alias deprecation 마킹

**Files:**
- Modify: `packages/resource-policy-store/src/index.ts`

본 plan은 alias 자체를 제거하지 않는다 — workspace 외부 패키지가 본 alias를 참조할 가능성을 보존한다. JSDoc `@deprecated` + 주석으로 의도를 표시하고, 후속 plan에서 제거.

- [ ] **Step 1: index.ts에 deprecation 마킹 추가**

`packages/resource-policy-store/src/index.ts`의 `DrizzleResourcePolicyRegistry` alias 라인을 다음으로 교체:

```ts
/**
 * @deprecated Plan 05d 이후 호출자는 `createResourcePolicyRegistry({ dialect: "sqlite", db })`
 * 를 사용한다. 본 alias는 외부 호환성 유예만 위해 유지되며, 후속 plan에서 제거된다.
 *
 * 마이그레이션 가이드:
 * ```ts
 * // Before
 * import { DrizzleResourcePolicyRegistry } from "resource-policy-store";
 * const reg = new DrizzleResourcePolicyRegistry(db);
 *
 * // After
 * import { createResourcePolicyRegistry } from "resource-policy-store";
 * const reg = await createResourcePolicyRegistry({ dialect: "sqlite", db });
 * ```
 */
export { SqliteResourcePolicyRegistry as DrizzleResourcePolicyRegistry } from "./sqlite/adapter.js";
```

JSDoc `@deprecated` 태그는 IDE/typecheck에서 호출 사이트에 deprecation 경고를 띄운다.

- [ ] **Step 2: typecheck로 deprecation 경고 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store typecheck
```

Expected: 0 error. `--strict` 또는 `noImplicitAny`와 무관하게 deprecation은 타입 에러 아님 (IDE warning만).

- [ ] **Step 3: 워크스페이스 모든 호출자에서 deprecation 회귀 0 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store build && \
  grep -A1 "@deprecated" packages/resource-policy-store/dist/index.d.ts | head -10
```

Expected: dist d.ts에 `@deprecated` JSDoc 노출 — 외부 패키지에서 import 시 IDE에 경고 표시.

- [ ] **Step 4: 워크스페이스 전체 build 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm -r build 2>&1 | tail -10
```

Expected: 빌드 0 error. deprecation은 빌드를 막지 않음.

- [ ] **Step 5: 워크스페이스 전체 test 회귀 (광범위 안전망)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm -r test 2>&1 | tail -20
```

Expected: 모두 통과 또는 본 plan과 무관한 기존 known-fail만. 본 plan으로 인한 신규 fail 0.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/index.ts && \
  git commit -m "$(cat <<'EOF'
docs(resource-policy-store): DrizzleResourcePolicyRegistry alias @deprecated 마킹

Plan 05d로 모든 내부 호출자가 createResourcePolicyRegistry로 전환됨.
alias는 외부 호환성 유예 위해 유지하되 JSDoc @deprecated + 마이그레이션 가이드 추가.
실제 제거는 후속 plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 최종 회귀 + 인벤토리 봉인

- [ ] **Step 1: 호출자 패턴 잔여 0 최종 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "new DrizzleResourcePolicyRegistry\|new SqliteResourcePolicyRegistry\|new PgResourcePolicyRegistry" packages --include="*.ts" | \
  grep -v node_modules | grep -v dist | grep -v "resource-policy-store/src/sqlite/adapter\|resource-policy-store/src/pg/adapter"
```

Expected: 0 hit.

- [ ] **Step 2: factory 호출 사이트 전수 조사 (사용 분포 가시화)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "createResourcePolicyRegistry" packages --include="*.ts" | \
  grep -v node_modules | grep -v dist | grep -v "resource-policy-store/src/factory"
```

Expected: 최소 3 hit — `resource-policy-store/src/e2e-integration.test.ts`, `audit-recorder-store/src/e2e-integration.test.ts`, `resource-policy-store/src/port-contract.test.ts` (Plan 05c 산출물).

- [ ] **Step 3: PG 활성화 환경에서도 회귀 검증**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store --filter audit-recorder-store test 2>&1 | tail -20
```

Expected: contract test 16 PASS (SQLite 8 + PG 8) + 다른 e2e/단위 모두 통과.

- [ ] **Step 4: dist 봉인 — d.ts에 factory + alias 모두 노출**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store build && \
  grep -E "createResourcePolicyRegistry|DrizzleResourcePolicyRegistry|SqliteResourcePolicyRegistry|PgResourcePolicyRegistry" \
  packages/resource-policy-store/dist/index.d.ts | head -10
```

Expected: 4 심볼 모두 노출. `DrizzleResourcePolicyRegistry`는 `@deprecated` 주석과 함께.

---

## Self-Review

- [ ] 본 plan 시점 모든 외부 호출자가 factory 사용 (`new SqliteResourcePolicyRegistry`/`new DrizzleResourcePolicyRegistry` 0 hit)
- [ ] 두 e2e-integration.test.ts가 fixture + factory + try/finally cleanup 패턴 통일
- [ ] `audit-recorder-store/e2e-integration`이 SQLite 인스턴스 1개 공유 패턴 보존 (DDL concat)
- [ ] `DrizzleResourcePolicyRegistry` alias가 `@deprecated` JSDoc + 마이그레이션 가이드 포함
- [ ] dist d.ts에 deprecation 노출 (외부 패키지 IDE 경고)
- [ ] 모든 test count 본 plan 시작 시점과 동일 (회귀 0, 시나리오 변경 0)
- [ ] PG 활성화 환경에서도 contract test 회귀 0
- [ ] `permission-engine/access-checker/checker.ts`는 인터페이스만 사용 — 본 plan에서 변경 없음

---

## Defer

| 작업 | 이유 |
|---|---|
| `DrizzleResourcePolicyRegistry` alias **제거** (deprecation → removal) | 별도 plan — workspace 외부 패키지(릴리스된 SDK 등) 호출자 회귀 검증 사이클이 필요 |
| permission-engine `access-checker` 호출자가 factory 도움받아 인스턴스화 통합 | 본 plan 범위 외 — checker는 인터페이스만 받고 호출자(서비스 부팅 코드)가 factory를 호출하는 패턴이 정석. 서비스 부팅 코드는 Plan 04d/06 시점에서 통합. |
| `DrizzleAuditRecorder` factory화 (`createAuditRecorder({ dialect, db })`) | Plan 06 (audit-recorder-store dual-target) 범위 |
| 호출자가 `db-bootstrap`의 `createConnection`까지 통합 (`parseDbEnv` → `createConnection` → `createResourcePolicyRegistry` 3단계 wiring 헬퍼) | 사용 패턴 안정화 후 — 1차는 명시적 분리 유지 |
| ESLint custom rule로 `new SqliteResourcePolicyRegistry`/`new PgResourcePolicyRegistry` 직접 호출 금지 | tooling plan (별도) — 본 plan은 grep 게이트로 충분 |

---

## 의존·후속

- **Plan 05c**: 본 plan의 직접 의존 (factory + port가 존재해야 호출자가 마이그레이션 가능). 미완료 시 본 plan 시작 금지.
- **Plan 04c (db-bootstrap)**: 본 plan의 fixture 헬퍼 의존. `audit-recorder-store`에 devDep 추가 필요할 수 있음.
- **Plan 04a (qa-sdk-db)**: PG 활성화 회귀 단계에서만 필요. 미부팅이어도 SQLite 회귀는 통과.
- **Plan 06 (audit-recorder-store dual-target)**: 본 plan 완료 후 시작. `DrizzleAuditRecorder` 자체 factory화 + audit-recorder-store의 외부 호출자(있을 경우) 마이그레이션 패턴이 본 plan과 동일.
- **Alias 제거 plan (TBD)**: `DrizzleResourcePolicyRegistry` deprecation의 실제 제거. 워크스페이스 외부 호출자 회귀 사이클 후 별도 plan으로 진행.
