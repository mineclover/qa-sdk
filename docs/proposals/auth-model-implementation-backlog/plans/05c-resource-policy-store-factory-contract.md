# Plan 05c — resource-policy-store factory + port-contract test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `resource-policy-store`에 `src/factory.ts`를 도입해 `createResourcePolicyRegistry({ dialect, db })` dynamic-import factory를 제공한다. `src/port.ts`로 `permission-engine`의 `ResourcePolicyRegistry` 인터페이스를 store 패키지에서도 한 곳에서 노출하고, `src/port-contract.test.ts`에서 SQLite·PG 양쪽 어댑터에 동일 시나리오를 적용해 dialect 독립성(equivalence)을 회귀 게이트로 고정한다. db-bootstrap의 `createSqliteTestFixture`/`createPgTestFixture`를 단일 진입점으로 사용한다.

**Architecture:**
- `src/port.ts` — `permission-engine`의 `ResourcePolicyRegistry`·도메인 타입을 store 사용자가 두 패키지에서 import 하지 않도록 re-export. `port-contract.test.ts`도 본 파일에서 인터페이스 import.
- `src/factory.ts` — dialect별 dynamic import. 미설치 드라이버 환경에서는 그 dialect 분기에 닿지 않으면 부팅 가능 (peerDep optional 동기).
- `src/port-contract.test.ts` — `describe.each`로 SQLite + (env gate) PG fixture에 동일 8개 시나리오 적용. 동일 입력→동일 출력. dialect-specific edge는 본 파일에 들어오지 않음 (그건 `sqlite/adapter.test.ts`·`pg/adapter.test.ts`의 책임).
- e2e 회귀: 기존 SQLite 어댑터를 직접 import하던 e2e-integration.test가 본 plan에서는 영향 없음 — 마이그레이션은 Plan 05d에서 담당.

**Tech Stack:**
- drizzle-orm catalog
- db-bootstrap workspace dep (Plan 04c)
- `permission-engine` workspace dep (port re-export)
- vitest, TypeScript ES2023
- 양쪽 fixture에 사용할 DDL: `RESOURCE_POLICIES_DDL`(SQLite, Plan 05a) + `RESOURCE_POLICIES_PG_DDL`(PG, Plan 05b)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/resource-policy-store/src/port.ts` | `permission-engine`의 `ResourcePolicyRegistry`·도메인 타입 re-export |
| `packages/resource-policy-store/src/port.test.ts` | port re-export가 인터페이스 동일성 유지하는지 검증 (smoke) |
| `packages/resource-policy-store/src/factory.ts` | `createResourcePolicyRegistry({ dialect, db })` dynamic import |
| `packages/resource-policy-store/src/factory.test.ts` | factory 분기 + 잘못된 dialect 처리 단위 테스트 (SQLite 측 한정, PG는 contract에서) |
| `packages/resource-policy-store/src/port-contract.test.ts` | SQLite + PG 동일 시나리오 8건 (env gate) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/resource-policy-store/src/index.ts` | `factory`·`port` re-export 추가 |
| `packages/resource-policy-store/package.json` | `db-bootstrap` workspace dep 추가 (devDependency) |

### 변경하지 않는 파일 (Plan 05d 영역)

| 경로 | 이유 |
|---|---|
| `packages/resource-policy-store/src/e2e-integration.test.ts` | 호출자 마이그레이션은 Plan 05d. 본 plan은 factory만 도입 (회귀 0). |
| `packages/permission-engine/src/access-checker/checker.ts` | 인터페이스만 사용 — 변경 없음. |
| `packages/audit-recorder-store/src/e2e-integration.test.ts` | Plan 05d에서 마이그레이션. |

---

## Task 0: baseline

- [ ] **Step 1: Plan 05a + 05b 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/resource-policy-store/src/sqlite/adapter.ts packages/resource-policy-store/src/pg/adapter.ts && \
  grep -n "SqliteResourcePolicyRegistry\|PgResourcePolicyRegistry" packages/resource-policy-store/src/index.ts
```

Expected: 두 파일 hit + index.ts에 양쪽 export. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: Plan 04c (db-bootstrap) 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "createSqliteTestFixture\|createPgTestFixture" packages/db-bootstrap/src/index.ts
```

Expected: 둘 다 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 3: 현재 회귀 baseline 측정**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -5
```

Expected: SQLite 어댑터 테스트 + e2e-integration + (env 있으면 PG) 모두 통과. 본 plan 종료 시 동일 카운트 + 신규 contract test 추가만.

- [ ] **Step 4: qa-sdk-db 컨테이너 부팅 (PG contract 검증용)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml up -d qa-sdk-db && sleep 10 && \
  docker compose -f docker-compose.infra.yaml ps qa-sdk-db | grep healthy
```

Expected: status `healthy`. 미부팅 시 PG contract test는 skip되지만, 본 plan 검증 단계에서 PG도 통과해야 완료로 인정.

- [ ] **Step 5: 외부 호출자 식별 (Plan 05d 인수 자료)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "DrizzleResourcePolicyRegistry\|SqliteResourcePolicyRegistry\|PgResourcePolicyRegistry\|new SqliteResourcePolicy\|new PgResourcePolicy" packages --include="*.ts" | \
  grep -v node_modules | grep -v dist | grep -v "resource-policy-store/src"
```

Expected: 호출자 목록을 별도 메모. 본 plan은 어떤 호출자도 변경하지 않음 (factory 도입만).

---

## Task 1: package.json — db-bootstrap dev dep

**Files:**
- Modify: `packages/resource-policy-store/package.json`

- [ ] **Step 1: devDependencies에 `db-bootstrap` 추가**

`packages/resource-policy-store/package.json`의 `devDependencies` 블록에 추가:

```json
{
  "devDependencies": {
    "@types/better-sqlite3": "catalog:",
    "@types/node": "^22.0.0",
    "better-sqlite3": "catalog:",
    "db-bootstrap": "workspace:*",
    "postgres": "^3.4.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

`db-bootstrap`은 dev에만 둔다 — 본 패키지가 런타임에 fixture 헬퍼를 노출할 일 없음. dialect 선택 로직은 factory가 가지고, fixture는 테스트 전용.

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: `db-bootstrap` workspace 링크 성공. 잠금 갱신.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/package.json pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
chore(resource-policy-store): db-bootstrap devDep — port-contract fixture 도입 준비

Plan 05c에서 양쪽 어댑터를 contract test로 검증하기 위해
db-bootstrap의 createSqliteTestFixture·createPgTestFixture 사용.
런타임 의존 아니므로 devDependencies에만 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: src/port.ts — 인터페이스 re-export

**Files:**
- Create: `packages/resource-policy-store/src/port.ts`
- Create: `packages/resource-policy-store/src/port.test.ts`

- [ ] **Step 1: 테스트 먼저 — port.test.ts**

`packages/resource-policy-store/src/port.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { describe, expect, it } from "vitest";

import {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
} from "./port.js";

import {
  DuplicatePolicyError as PeDuplicate,
  PolicyNotFoundError as PeNotFound,
} from "permission-engine";

describe("port re-export — permission-engine 인터페이스 동일성", () => {
  it("DuplicatePolicyError가 permission-engine 동일 클래스", () => {
    expect(DuplicatePolicyError).toBe(PeDuplicate);
    const err = new DuplicatePolicyError("r1");
    expect(err).toBeInstanceOf(PeDuplicate);
    expect(err.resourceId).toBe("r1");
  });

  it("PolicyNotFoundError도 동일 클래스", () => {
    expect(PolicyNotFoundError).toBe(PeNotFound);
    const err = new PolicyNotFoundError("r2");
    expect(err).toBeInstanceOf(PeNotFound);
    expect(err.resourceId).toBe("r2");
  });

  it("ResourcePolicyState 리터럴 union 검증 (구조 타입 smoke)", () => {
    const states: ResourcePolicyState[] = ["UNREGISTERED", "REGISTERED", "DELEGATED"];
    expect(states).toHaveLength(3);
  });

  it("ResourcePolicyRegistry 인터페이스 메서드 6종을 포함하는 dummy 구현 가능", () => {
    // 컴파일 통과 자체가 검증 — runtime check는 dummy 호출
    const dummy: ResourcePolicyRegistry = {
      async resolve() { return null; },
      async create() { return makeStub(); },
      async register() { return makeStub(); },
      async delegate() { return makeStub(); },
      async remove() { /* noop */ },
      async listByOwner() { return []; },
      async listByState() { return []; },
    };
    expect(typeof dummy.resolve).toBe("function");
    expect(typeof dummy.create).toBe("function");
    expect(typeof dummy.register).toBe("function");
    expect(typeof dummy.delegate).toBe("function");
    expect(typeof dummy.remove).toBe("function");
    expect(typeof dummy.listByOwner).toBe("function");
    expect(typeof dummy.listByState).toBe("function");
  });
});

function makeStub(): ResourcePolicy {
  return {
    resourceId: "stub",
    resourceType: "doc",
    state: "UNREGISTERED",
    ownerId: "u",
    updatedAt: "2026-04-22T00:00:00.000Z",
  };
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test -- port.test
```

Expected: FAIL — `./port.js` 모듈 없음.

- [ ] **Step 3: 구현 — port.ts**

`packages/resource-policy-store/src/port.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * port.ts — `permission-engine`의 ResourcePolicyRegistry 인터페이스와
 * 도메인 타입을 store 패키지에서 한 곳에 모아 re-export.
 *
 * 외부 호출자는 두 패키지(permission-engine + resource-policy-store)에서
 * 타입을 분리 import 하지 않고 본 진입점만 사용한다.
 *
 * 본 파일은 단순 re-export — 별도 인터페이스를 새로 정의하지 않는다.
 * permission-engine이 인터페이스 SSOT.
 */

export {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
  type ResourcePolicyCreateArgs,
  type ResourcePolicyRegisterArgs,
  type ResourcePolicyDelegateArgs,
} from "permission-engine";
```

- [ ] **Step 4: permission-engine export 확인**

만약 `permission-engine`이 `ResourcePolicyCreateArgs`·`ResourcePolicyRegisterArgs`·`ResourcePolicyDelegateArgs`를 그 이름으로 export 하지 않으면 별칭 import:

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "ResourcePolicyCreateArgs\|ResourcePolicyRegisterArgs\|ResourcePolicyDelegateArgs\|export type CreateArgs\|export type RegisterArgs\|export type DelegateArgs" \
  packages/permission-engine/src/resource-policy/state.ts packages/permission-engine/src/resource-policy/index.ts packages/permission-engine/src/index.ts
```

`permission-engine`이 `CreateArgs`/`RegisterArgs`/`DelegateArgs`로 export 한다면 `port.ts`를 다음으로 수정 (이미 sqlite/adapter.ts·pg/adapter.ts가 `ResourcePolicy*Args`로 import 하므로 양쪽 어댑터 import 패턴과 일치하는 별칭 사용):

```ts
export {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
  type CreateArgs as ResourcePolicyCreateArgs,
  type RegisterArgs as ResourcePolicyRegisterArgs,
  type DelegateArgs as ResourcePolicyDelegateArgs,
} from "permission-engine";
```

별칭 패턴 결정 규칙: **양쪽 어댑터(sqlite/adapter.ts, pg/adapter.ts)가 이미 사용 중인 이름**을 따른다. 이 두 파일의 import 시그니처를 SSOT로 본다.

- [ ] **Step 5: 테스트 통과 확인 + typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store typecheck && \
  pnpm --filter resource-policy-store test -- port.test
```

Expected: typecheck 0 error, port.test 4 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/port.ts packages/resource-policy-store/src/port.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(resource-policy-store): src/port.ts — permission-engine 인터페이스 re-export

호출자가 인터페이스+어댑터를 한 import 경로(resource-policy-store)에서
받을 수 있도록 port 진입점 신설. permission-engine이 인터페이스 SSOT 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: src/factory.ts — createResourcePolicyRegistry

**Files:**
- Create: `packages/resource-policy-store/src/factory.ts`
- Create: `packages/resource-policy-store/src/factory.test.ts`

- [ ] **Step 1: 테스트 먼저 — factory.test.ts (SQLite 측만)**

`packages/resource-policy-store/src/factory.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { describe, expect, it } from "vitest";

import { createResourcePolicyRegistry } from "./factory.js";
import { createSqliteTestFixture } from "db-bootstrap";
import { RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";

describe("createResourcePolicyRegistry — dialect 분기", () => {
  it("dialect=sqlite → SqliteResourcePolicyRegistry 인스턴스", async () => {
    const { db, cleanup } = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
    try {
      const registry = await createResourcePolicyRegistry({ dialect: "sqlite", db });
      expect(registry.constructor.name).toBe("SqliteResourcePolicyRegistry");
      // smoke — 인터페이스 메서드 호출 가능
      const result = await registry.resolve("nonexistent");
      expect(result).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("dialect=sqlite로 create + resolve 라운드트립", async () => {
    const { db, cleanup } = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
    try {
      const registry = await createResourcePolicyRegistry({ dialect: "sqlite", db });
      await registry.create({ resourceId: "r1", resourceType: "doc", ownerId: "u1" });
      const got = await registry.resolve("r1");
      expect(got?.state).toBe("UNREGISTERED");
      expect(got?.ownerId).toBe("u1");
    } finally {
      await cleanup();
    }
  });

  it("잘못된 dialect → 에러 throw", async () => {
    await expect(
      // @ts-expect-error — invalid dialect 의도적 주입
      createResourcePolicyRegistry({ dialect: "mongo", db: {} }),
    ).rejects.toThrow(/dialect/i);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test -- factory.test
```

Expected: FAIL — `./factory.js` 없음.

- [ ] **Step 3: 구현 — factory.ts**

`packages/resource-policy-store/src/factory.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * createResourcePolicyRegistry — dialect별 어댑터 인스턴스화 진입점.
 *
 * dynamic import로 드라이버 로드 — 미설치 dialect 분기에 닿지 않으면
 * 본 모듈 import 자체는 실패하지 않는다 (peerDep optional 패턴 동기).
 *
 * 호출자는 db-bootstrap의 createConnection으로 dialect별 Drizzle DB를 만들고,
 * 그 db를 본 factory에 넘겨 어댑터를 받는다.
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { ResourcePolicyRegistry } from "./port.js";

export type ResourcePolicyDialect = "sqlite" | "pg";

export interface CreateRegistryOptions {
  dialect: ResourcePolicyDialect;
  /**
   * Drizzle DB 인스턴스.
   * - dialect="sqlite" → BetterSQLite3Database
   * - dialect="pg"     → PostgresJsDatabase
   * 타입 검증은 어댑터 생성자가 수행 (런타임 cast).
   */
  db: BetterSQLite3Database | PostgresJsDatabase;
}

export async function createResourcePolicyRegistry(
  opts: CreateRegistryOptions,
): Promise<ResourcePolicyRegistry> {
  if (opts.dialect === "sqlite") {
    const { SqliteResourcePolicyRegistry } = await import("./sqlite/adapter.js");
    return new SqliteResourcePolicyRegistry(opts.db as BetterSQLite3Database);
  }

  if (opts.dialect === "pg") {
    const { PgResourcePolicyRegistry } = await import("./pg/adapter.js");
    return new PgResourcePolicyRegistry(opts.db as PostgresJsDatabase);
  }

  // 컴파일러는 unreachable로 보지만 런타임 안전망
  throw new Error(
    `createResourcePolicyRegistry: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
```

- [ ] **Step 4: index.ts 추가 export**

`packages/resource-policy-store/src/index.ts` 끝에:

```ts
// Factory + port (Plan 05c)
export {
  createResourcePolicyRegistry,
  type CreateRegistryOptions,
  type ResourcePolicyDialect,
} from "./factory.js";

export {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
  type ResourcePolicyCreateArgs,
  type ResourcePolicyRegisterArgs,
  type ResourcePolicyDelegateArgs,
} from "./port.js";
```

- [ ] **Step 5: typecheck + factory test 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store typecheck && \
  pnpm --filter resource-policy-store test -- factory.test
```

Expected: typecheck 0 error, factory.test 3 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/factory.ts packages/resource-policy-store/src/factory.test.ts packages/resource-policy-store/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(resource-policy-store): createResourcePolicyRegistry — dialect 분기 factory

dynamic import로 SqliteResourcePolicyRegistry / PgResourcePolicyRegistry 분기.
미설치 드라이버 환경에서 본 모듈 import는 실패하지 않음 (분기 진입 시에만 로드).
잘못된 dialect는 명시적 throw — silent fallback 금지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: src/port-contract.test.ts — 양쪽 어댑터 동등성

**Files:**
- Create: `packages/resource-policy-store/src/port-contract.test.ts`

contract test 원칙:

1. **인터페이스 동등성만 검증** — 같은 입력에 같은 출력. dialect-specific edge는 본 파일에 들어오지 않음.
2. **fixture는 db-bootstrap에서** — `createSqliteTestFixture`/`createPgTestFixture`. PG는 env gate.
3. **시나리오는 비즈니스 의미 기반** — 8개 사례로 lifecycle FSM·invariant·error 경로 모두 커버.
4. **factory를 거쳐 어댑터 인스턴스화** — 직접 `new SqliteResourcePolicyRegistry`/`new PgResourcePolicyRegistry` 호출 금지. factory가 회귀 게이트.

- [ ] **Step 1: 테스트 작성**

`packages/resource-policy-store/src/port-contract.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * Port-contract test — SQLite + PG 어댑터에 동일 시나리오 적용.
 *
 * 본 파일에 들어오는 시나리오는 dialect-agnostic이어야 한다.
 * dialect-specific edge(WAL mode, RLS, search_path 등)는
 *   - sqlite/adapter.test.ts
 *   - pg/adapter.test.ts
 * 의 책임. 본 파일은 두 어댑터가 같은 인터페이스 계약을 만족하는지만 검증.
 *
 * PG는 env gate — QA_TEST_PG=1 이면 활성화, 아니면 SQLite만 검증.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createPgTestFixture,
  createSqliteTestFixture,
  type PgFixture,
  type SqliteFixture,
} from "db-bootstrap";

import {
  createResourcePolicyRegistry,
  type ResourcePolicyDialect,
} from "./factory.js";
import {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicyRegistry,
} from "./port.js";
import { RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";
import { RESOURCE_POLICIES_PG_DDL } from "./pg/schema.js";

// ── Fixture 추상화 ────────────────────────────────────────────────────────────

interface FixtureRunner {
  /** 새 격리 fixture를 만들고 factory로 어댑터를 인스턴스화 */
  setup(): Promise<{ registry: ResourcePolicyRegistry; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const fixture: SqliteFixture = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
    const registry = await createResourcePolicyRegistry({
      dialect: "sqlite",
      db: fixture.db as never,
    });
    return { registry, cleanup: fixture.cleanup };
  },
};

function makePgRunner(): FixtureRunner {
  const PG_CFG = {
    pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
    pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
    pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  return {
    async setup() {
      // pg DDL은 'auth' schema 가정 — fixture가 random schema에 search_path 적용하므로
      // 'auth.' prefix를 schema-less 형태로 변환. CREATE SCHEMA 라인은 fixture가 이미 생성.
      const ddl = RESOURCE_POLICIES_PG_DDL
        .replace(/CREATE SCHEMA IF NOT EXISTS auth;\s*/g, "")
        .replaceAll("auth.", "");
      const fixture: PgFixture = await createPgTestFixture(ddl, PG_CFG);
      const registry = await createResourcePolicyRegistry({
        dialect: "pg",
        db: fixture.db as never,
      });
      return { registry, cleanup: fixture.cleanup };
    },
  };
}

// ── 매트릭스 ─────────────────────────────────────────────────────────────────

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const matrix: Array<[ResourcePolicyDialect, FixtureRunner]> = [
  ["sqlite", sqliteRunner],
  ...(PG_AVAILABLE
    ? ([["pg", makePgRunner()]] as const)
    : []),
];

describe.each(matrix)(
  "ResourcePolicyRegistry contract — %s",
  (_dialect, runner) => {
    let registry: ResourcePolicyRegistry;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
      const ctx = await runner.setup();
      registry = ctx.registry;
      cleanup = ctx.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

    it("1. resolve(미존재) → null", async () => {
      const got = await registry.resolve("missing");
      expect(got).toBeNull();
    });

    it("2. create 후 resolve → UNREGISTERED 상태로 복원", async () => {
      await registry.create({
        resourceId: "doc-1",
        resourceType: "document",
        ownerId: "user-A",
      });
      const got = await registry.resolve("doc-1");
      expect(got?.state).toBe("UNREGISTERED");
      expect(got?.resourceType).toBe("document");
      expect(got?.ownerId).toBe("user-A");
      expect(got?.cerbosPolicyRef).toBeUndefined();
      expect(got?.graphRootId).toBeUndefined();
    });

    it("3. create 중복 → DuplicatePolicyError", async () => {
      await registry.create({
        resourceId: "doc-2",
        resourceType: "document",
        ownerId: "user-A",
      });
      await expect(
        registry.create({
          resourceId: "doc-2",
          resourceType: "document",
          ownerId: "user-B",
        }),
      ).rejects.toBeInstanceOf(DuplicatePolicyError);
    });

    it("4. UNREGISTERED → REGISTERED 전이", async () => {
      await registry.create({
        resourceId: "doc-3",
        resourceType: "document",
        ownerId: "user-A",
      });
      const next = await registry.register("doc-3", {
        cerbosPolicyRef: "cerbos:doc-shared-v1",
      });
      expect(next.state).toBe("REGISTERED");
      expect(next.cerbosPolicyRef).toBe("cerbos:doc-shared-v1");
      expect(next.registeredAt).toBeDefined();

      const persisted = await registry.resolve("doc-3");
      expect(persisted?.state).toBe("REGISTERED");
      expect(persisted?.cerbosPolicyRef).toBe("cerbos:doc-shared-v1");
    });

    it("5. REGISTERED → DELEGATED 전이", async () => {
      await registry.create({
        resourceId: "doc-4",
        resourceType: "document",
        ownerId: "user-A",
      });
      await registry.register("doc-4", {
        cerbosPolicyRef: "cerbos:doc-shared-v1",
      });
      const next = await registry.delegate("doc-4", {
        graphRootId: "graph-root-9",
      });
      expect(next.state).toBe("DELEGATED");
      expect(next.graphRootId).toBe("graph-root-9");
      expect(next.delegatedAt).toBeDefined();

      const persisted = await registry.resolve("doc-4");
      expect(persisted?.state).toBe("DELEGATED");
    });

    it("6. 미존재 리소스에 register/delegate → PolicyNotFoundError", async () => {
      await expect(
        registry.register("ghost", { cerbosPolicyRef: "x" }),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
      await expect(
        registry.delegate("ghost", { graphRootId: "g" }),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
    });

    it("7. listByOwner — 같은 owner의 리소스만 반환", async () => {
      await registry.create({ resourceId: "a1", resourceType: "doc", ownerId: "U" });
      await registry.create({ resourceId: "a2", resourceType: "doc", ownerId: "U" });
      await registry.create({ resourceId: "b1", resourceType: "doc", ownerId: "V" });
      const owned = await registry.listByOwner("U");
      const ids = owned.map((p) => p.resourceId).sort();
      expect(ids).toEqual(["a1", "a2"]);
    });

    it("8. listByState + remove — 상태 전이 후 카운트 변화 + 삭제 invariant", async () => {
      await registry.create({ resourceId: "s1", resourceType: "doc", ownerId: "U" });
      await registry.create({ resourceId: "s2", resourceType: "doc", ownerId: "U" });
      await registry.register("s2", { cerbosPolicyRef: "p" });

      const unreg = await registry.listByState("UNREGISTERED");
      const reg = await registry.listByState("REGISTERED");
      expect(unreg.map((p) => p.resourceId)).toEqual(["s1"]);
      expect(reg.map((p) => p.resourceId)).toEqual(["s2"]);

      await registry.remove("s1");
      const afterRemove = await registry.resolve("s1");
      expect(afterRemove).toBeNull();

      // 다른 리소스는 영향 없음
      const stillRegistered = await registry.resolve("s2");
      expect(stillRegistered?.state).toBe("REGISTERED");
    });
  },
);
```

- [ ] **Step 2: SQLite 매트릭스만 검증 (PG env 없음)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store test -- port-contract
```

Expected: 8 PASS (SQLite 8건). PG 분기는 매트릭스에서 빠져 0건. 콘솔에 `pg` 시나리오 없음 확인.

- [ ] **Step 3: PG 활성화로 양쪽 매트릭스 검증**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store test -- port-contract
```

Expected: 16 PASS (SQLite 8 + PG 8). 한 dialect라도 fail 나면 plan 미완료.

- [ ] **Step 4: cleanup 잔여물 검증 (PG random schema drop 확인)**

```bash
docker compose -f /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/docker-compose.infra.yaml \
  exec -T qa-sdk-db psql -U qa_admin -d qa_sdk_test -tA -c \
  "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'test_%';"
```

Expected: empty. 누수 시 fixture cleanup 회귀 — 본 plan 종료 전 수정 필요.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/port-contract.test.ts && \
  git commit -m "$(cat <<'EOF'
test(resource-policy-store): port-contract — SQLite/PG 동등성 8 시나리오

describe.each 매트릭스로 양쪽 어댑터에 동일 입력 적용.
factory를 통해 인스턴스화 (직접 new 호출 금지) — factory 자체도 회귀 게이트.
PG는 QA_TEST_PG=1 env gate. 매트릭스에 들어오면 16 PASS, 아니면 8 PASS.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀

- [ ] **Step 1: SQLite 어댑터 단위 테스트 회귀 (Plan 05a)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store test -- sqlite/adapter.test
```

Expected: 12+ PASS (Plan 05a baseline 동일).

- [ ] **Step 2: PG 어댑터 단위 테스트 회귀 (Plan 05b)**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store test -- pg/adapter.test
```

Expected: 4 PASS (Plan 05b baseline 동일).

- [ ] **Step 3: e2e-integration.test 회귀 (호출자 마이그레이션은 05d, 본 plan은 영향 0)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store test -- e2e-integration
```

Expected: 통과 (기존 `DrizzleResourcePolicyRegistry` alias 그대로 사용).

- [ ] **Step 4: permission-engine + audit-recorder-store 외부 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter permission-engine --filter audit-recorder-store test 2>&1 | tail -10
```

Expected: 양쪽 모두 통과. 외부 호출자 인터페이스 영향 없음.

- [ ] **Step 5: 전체 dist 재빌드 + d.ts 노출 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store build && \
  grep -E "createResourcePolicyRegistry|ResourcePolicyDialect|PolicyNotFoundError" \
  packages/resource-policy-store/dist/index.d.ts | head -10
```

Expected: 세 심볼 모두 d.ts에 노출. 빌드 에러 0.

---

## Self-Review

- [ ] `port.ts`가 `permission-engine`을 SSOT로 두고 단순 re-export — 인터페이스 중복 정의 없음
- [ ] `factory.ts`가 dynamic import로 두 어댑터를 분기 — 미설치 드라이버 환경에서 모듈 import 가능
- [ ] `factory.test.ts`가 SQLite 분기·라운드트립·invalid dialect 3건 검증
- [ ] `port-contract.test.ts`가 8 시나리오 × dialect — SQLite 단독 8 PASS, PG 활성화 시 16 PASS
- [ ] PG fixture cleanup 후 `qa_sdk_test` 잔여 schema 0
- [ ] 외부 호출자 코드 변경 없음 (Plan 05d 영역)
- [ ] dist d.ts에 factory + port 심볼 모두 노출
- [ ] index.ts에 기존 `DrizzleResourcePolicyRegistry` alias 유지 — 본 plan은 deprecation 안 함

---

## Defer

| 작업 | 이유 |
|---|---|
| `DrizzleResourcePolicyRegistry` alias deprecation 마킹 | Plan 05d 마지막 단계 — 모든 호출자가 factory로 전환된 후 |
| 외부 호출자 (permission-engine e2e, audit-recorder-store e2e, resource-policy-store/e2e-integration) factory 전환 | Plan 05d |
| factory에 `db-bootstrap`의 `createConnection` 통합 (한 번에 connection + registry 생성) | 사용 패턴 안정화 후 — 1차는 db / registry 두 단계 분리가 명시적이라 유지보수 우위 |
| RLS-aware factory 옵션 (PG only — 호출자 user/role을 connection 속성으로 전달) | Phase 3 RLS plan |
| Drizzle Kit 마이그레이션 runner를 factory와 통합 | 06b 패턴 반영 후 |

---

## 의존·후속

- **Plan 05a + 05b**: 본 plan의 직접 의존 (sqlite/, pg/ 디렉토리·어댑터 모두 존재해야 factory가 dynamic import 가능).
- **Plan 04c (db-bootstrap)**: 본 plan의 contract test fixture가 `createSqliteTestFixture`·`createPgTestFixture`를 사용. devDep 주입 필수.
- **Plan 04a (qa-sdk-db 컨테이너)**: PG contract test 분기 검증에 필수.
- **Plan 05d (호출자 마이그레이션)**: 본 plan 완료 직후 시작. factory가 진입점으로 자리잡으면 외부 호출자를 한 호출자씩 마이그레이션.
- **Plan 06 (audit-recorder-store)**: 본 plan의 factory + contract test 패턴을 동일하게 복제. port.ts 패턴 + describe.each 매트릭스 + db-bootstrap fixture가 표준.
