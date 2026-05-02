# Plan 15c — RLS Session Context 주입 미들웨어

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `authorization-ontology-rls-enforcement.spec.md` §방법 **Phase 3 — application 레이어 통합**을 구현한다. Plan 15a 의 helper 함수와 Plan 15b 의 정책이 참조하는 세션 컨텍스트 — `app.user_id`, `app.bitmap_mask`, `app.tenant_id`, `app.role` — 를 모든 PG 쿼리 이전에 `SET LOCAL` 로 자동 주입하는 단일 진입점을 `db-bootstrap` 에 추가하고 NestJS 서비스에 Interceptor 형태로 적용한다. 핵심은 (1) connection pool 재사용 시 세션 컨텍스트 유출 방지, (2) `SET LOCAL` 의 트랜잭션 경계 자동 준수, (3) bitmap Uint8Array → hex TEXT 직렬화, (4) request → user context (JWT claim) → GUC payload 변환.

**Architecture:**
- **핵심 API** (`db-bootstrap`):
  ```ts
  export interface RlsSessionContext {
    userId: string | null;
    tenantId: string | null;
    bitmapMask: Uint8Array | null;   // bytea — helper 에서 hex decode
    role: "admin" | null;
  }
  export type RlsTxRunner = <T>(ctx: RlsSessionContext, fn: (tx: PostgresJsTx) => Promise<T>) => Promise<T>;
  export function createRlsTxRunner(sql: Sql): RlsTxRunner;
  ```
- **SET LOCAL 의 트랜잭션 스코프 보장**: `postgres` driver 의 `sql.begin(async tx => ...)` 트랜잭션 내에서 `SET LOCAL` 을 호출 → 트랜잭션 종료 시 자동 clear. pool connection 이 재사용되어도 이전 세션 context 가 새 요청으로 누설되지 않음 (spec §주의사항 "연결 풀 재사용 안전성").
- **bitmap 직렬화**:
  - Uint8Array → hex TEXT: `Buffer.from(mask).toString("hex")` (Node) 또는 순수 JS fallback. `db-bootstrap/src/rls-session.ts` 에 `encodeBitmapHex` 유틸 제공.
  - PG helper 함수(`auth.has_bit`) 가 `decode(hex_mask, 'hex')` 로 bytea 변환하므로 hex 인코딩 스킴 일원화.
  - bitmap 크기 제한: spec §주의사항 "권한 공간이 2^20 (128KB)을 넘으면 부담". 128KB 초과 시 `BitmapTooLargeError` throw.
- **null-safe SET LOCAL**: JS 문자열 null 주입은 PG 에서 `'null'` 문자열이 되어 함수 오동작 가능. `null` 인 키는 **SET 자체를 skip** — helper 는 미주입 시 NULL 처리하므로 default deny 유지.
- **NestJS Interceptor** (각 도메인 service — auth-service, ingest-server, audit-browser-api, approval-api 등):
  - `RlsContextInterceptor` — request 의 JWT claim 에서 `userId`, `tenantId`, bitmap 을 추출하고 `AsyncLocalStorage` 에 저장.
  - Service 레이어는 `RlsTxRunner` 호출 시 `AsyncLocalStorage` 의 현재 context 를 자동 주입.
- **기존 adapter 와의 관계**:
  - `PgResourcePolicyRegistry`, `PgAuditRecorder`, ingest PG adapter 는 **기존 signature 유지** (비즈니스 로직 변경 없음).
  - 호출측에서 adapter 호출을 `rlsRunner(ctx, async (tx) => ...)` 로 감싸도록 migration.
  - 또는 adapter 생성 시 `RlsTxRunner` 를 주입받아 내부에서 자동 적용하는 래퍼 adapter `RlsAwarePgResourcePolicyRegistry` 를 추가 — 본 plan 은 2 단계 접근: (A) runner 유틸 도입, (B) interceptor 도입, (C) 1 호출자(resource-policy-store consumer) migration 데모. 나머지 서비스 마이그레이션은 후속 작업으로 defer.
- **CLI·배치 스크립트**: 별도 CLI context 주입 경로 — `createRlsTxRunner` 는 동일하지만 context 는 환경 변수 기반. admin CLI 는 `role: "admin"` 직접 지정.

**Tech Stack:**
- `db-bootstrap` (workspace, Plan 04c) — connection factory 확장
- `postgres` ^3.4.0 — transaction API (`sql.begin`)
- NestJS 11 — Interceptor + ExecutionContext
- `jsonwebtoken` 또는 기존 JWT 미들웨어 (Plan 12a sim-gateway 와 동일 claim 스킴 가정)
- AsyncLocalStorage (Node 내장, ES2023 호환)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/db-bootstrap/src/rls-session.ts` | `RlsSessionContext` 타입 + `createRlsTxRunner` + `encodeBitmapHex` |
| `packages/db-bootstrap/src/rls-session.test.ts` | SET LOCAL 트랜잭션 스코프 + hex 인코딩 + bitmap 크기 한계 (env gate) |
| `packages/db-bootstrap/src/rls-context-storage.ts` | AsyncLocalStorage 래퍼 — `getCurrentRlsContext`, `withRlsContext` |
| `packages/db-bootstrap/src/rls-context-storage.test.ts` | 동시성 격리 검증 |
| `packages/db-bootstrap/src/rls-nest-interceptor.ts` | NestJS Interceptor — JWT claim → RlsSessionContext |
| `packages/db-bootstrap/src/rls-nest-interceptor.test.ts` | interceptor mock request → context storage 주입 |
| `packages/resource-policy-store/src/pg/rls-aware-adapter.ts` | `RlsAwarePgResourcePolicyRegistry` — runner 자동 적용 래퍼 |
| `packages/resource-policy-store/src/pg/rls-aware-adapter.test.ts` | 래퍼가 context 미설정 시 어떻게 동작하는지 (default deny 회귀) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/db-bootstrap/package.json` | `@nestjs/common` peerDep optional + `rxjs` optional 추가 |
| `packages/db-bootstrap/src/index.ts` | 새 public export 추가 |
| `packages/resource-policy-store/src/index.ts` | `RlsAwarePgResourcePolicyRegistry` re-export |
| `packages/resource-policy-store/package.json` | `db-bootstrap` workspace dep 추가 (dev 아님) |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/infra-engine/init/qa-sdk-db-helpers.sql && \
  grep -n "RP_READ_BIT" packages/resource-policy-store/src/pg/rls-bits.ts && \
  ls packages/db-bootstrap/src/connection.ts
```

Expected: 3 hit. 미완료 항목은 Plan 15a/15b/04c 재실행.

- [ ] **Step 2: db-bootstrap 현재 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter db-bootstrap test 2>&1 | tail -5
```

Expected: 기존 테스트 PASS 수 기록. 본 plan 완료 후 회귀 대비.

- [ ] **Step 3: resource-policy-store RLS 테스트 baseline (Plan 15b)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -5
```

Expected: SQLite + PG (env gate 미설정 시 skip) 모두 PASS.

---

## Task 1: rls-session.ts — context 타입 + tx runner

**Files:**
- Create: `packages/db-bootstrap/src/rls-session.ts`
- Create: `packages/db-bootstrap/src/rls-session.test.ts`
- Modify: `packages/db-bootstrap/src/index.ts`

- [ ] **Step 1: rls-session.ts 작성**

`packages/db-bootstrap/src/rls-session.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { Sql, TransactionSql } from "postgres";

/**
 * PG RLS 정책이 참조하는 세션 컨텍스트 (spec §1 Session context).
 * - userId   → auth.current_user_id() — resource owner / audit actor 매칭
 * - tenantId → app.tenant_id            — ingest cross-tenant 경계
 * - bitmapMask → auth.has_bit(pos)      — 타입 레벨 정적 권한
 * - role     → 'admin' 이면 admin bypass 정책 매칭
 */
export interface RlsSessionContext {
  readonly userId: string | null;
  readonly tenantId: string | null;
  readonly bitmapMask: Uint8Array | null;
  readonly role: "admin" | null;
}

export const EMPTY_RLS_CONTEXT: RlsSessionContext = Object.freeze({
  userId: null,
  tenantId: null,
  bitmapMask: null,
  role: null,
});

/** spec §주의사항 "bitmap 크기 제한 — 2^20 (128KB) 권장". 초과 시 명시적 거절. */
export const MAX_BITMAP_BYTES = 128 * 1024;

export class BitmapTooLargeError extends Error {
  constructor(public readonly size: number) {
    super(`bitmap mask ${size} bytes exceeds MAX_BITMAP_BYTES=${MAX_BITMAP_BYTES}`);
    this.name = "BitmapTooLargeError";
  }
}

/** Uint8Array → lowercase hex TEXT (PG 의 decode(..., 'hex') 포맷과 일치). */
export function encodeBitmapHex(mask: Uint8Array): string {
  if (mask.byteLength > MAX_BITMAP_BYTES) {
    throw new BitmapTooLargeError(mask.byteLength);
  }
  let out = "";
  for (let i = 0; i < mask.length; i += 1) {
    out += mask[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * 트랜잭션 안에서 RlsSessionContext 를 SET LOCAL 로 주입한 뒤 fn 을 실행.
 *
 * 각 호출은 단일 트랜잭션 — SET LOCAL 이 자동 clear 되어 connection pool 재사용 시에도
 * 세션 컨텍스트 유출 없음. null 인 필드는 SET 자체를 skip (helper 에서 NULL 로 처리 → default deny).
 */
export type RlsTxRunner = <T>(
  ctx: RlsSessionContext,
  fn: (tx: TransactionSql) => Promise<T>,
) => Promise<T>;

export function createRlsTxRunner(sql: Sql): RlsTxRunner {
  return async <T>(ctx: RlsSessionContext, fn: (tx: TransactionSql) => Promise<T>) => {
    return sql.begin(async (tx) => {
      // SET LOCAL 은 parameterized 불가 → set_config(name, value, is_local) 사용.
      if (ctx.userId !== null) {
        await tx`SELECT set_config('app.user_id', ${ctx.userId}, true)`;
      }
      if (ctx.tenantId !== null) {
        await tx`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
      }
      if (ctx.bitmapMask !== null) {
        const hex = encodeBitmapHex(ctx.bitmapMask);
        await tx`SELECT set_config('app.bitmap_mask', ${hex}, true)`;
      }
      if (ctx.role !== null) {
        await tx`SELECT set_config('app.role', ${ctx.role}, true)`;
      }
      return fn(tx);
    }) as Promise<T>;
  };
}
```

- [ ] **Step 2: rls-session.test.ts — hex 인코딩 + crc · PG env gate 검증**

`packages/db-bootstrap/src/rls-session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  encodeBitmapHex,
  BitmapTooLargeError,
  createRlsTxRunner,
  MAX_BITMAP_BYTES,
} from "./rls-session.js";

describe("encodeBitmapHex — pure", () => {
  it("빈 배열 → 빈 문자열", () => {
    expect(encodeBitmapHex(new Uint8Array())).toBe("");
  });
  it("단일 byte 0x01 → '01'", () => {
    expect(encodeBitmapHex(new Uint8Array([0x01]))).toBe("01");
  });
  it("멀티 byte — big endian lowercase", () => {
    expect(encodeBitmapHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
  });
  it("upper limit 준수 → 예외", () => {
    const huge = new Uint8Array(MAX_BITMAP_BYTES + 1);
    expect(() => encodeBitmapHex(huge)).toThrow(BitmapTooLargeError);
  });
});

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("createRlsTxRunner — PG 통합", () => {
  const sql = postgres({
    host: process.env.QA_TEST_PG_HOST ?? "localhost",
    port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    user: process.env.QA_TEST_PG_USER ?? "qa_admin",
    password: process.env.QA_TEST_PG_PASSWORD ?? "",
    max: 3, onnotice: () => {},
  });
  const run = createRlsTxRunner(sql);

  it("SET LOCAL 이 fn 내부에서 읽힘", async () => {
    const result = await run(
      { userId: "alice", tenantId: "acme", bitmapMask: new Uint8Array([0x01]), role: null },
      async (tx) => {
        const [row] = await tx<{ user_id: string; tenant: string; mask: string }[]>`
          SELECT current_setting('app.user_id', true) AS user_id,
                 current_setting('app.tenant_id', true) AS tenant,
                 current_setting('app.bitmap_mask', true) AS mask`;
        return row;
      },
    );
    expect(result.user_id).toBe("alice");
    expect(result.tenant).toBe("acme");
    expect(result.mask).toBe("01");
  });

  it("트랜잭션 종료 후 GUC 소거 — 다음 트랜잭션은 null", async () => {
    await run(
      { userId: "bob", tenantId: null, bitmapMask: null, role: null },
      async (tx) => tx`SELECT 1`,
    );
    // 같은 pool connection 재사용 가능성 — 다른 트랜잭션에서 조회
    const [row] = await sql<{ user_id: string | null }[]>`SELECT current_setting('app.user_id', true) AS user_id`;
    expect(row.user_id === null || row.user_id === "").toBe(true);
  });

  it("null 필드는 SET skip — 이전 세션 값 누수 없음", async () => {
    // 첫 트랜잭션: userId='alice'
    await run({ userId: "alice", tenantId: null, bitmapMask: null, role: null }, async (tx) => tx`SELECT 1`);
    // 두번째 트랜잭션: userId null — SET skip 되지만 이전 트랜잭션 종료 시 자동 clear 로 여전히 null 이어야
    const result = await run(
      { userId: null, tenantId: null, bitmapMask: null, role: null },
      async (tx) => {
        const [row] = await tx<{ user_id: string | null }[]>`SELECT current_setting('app.user_id', true) AS user_id`;
        return row.user_id;
      },
    );
    expect(result === null || result === "").toBe(true);
  });

  it("admin role 주입", async () => {
    const role = await run(
      { userId: null, tenantId: null, bitmapMask: null, role: "admin" },
      async (tx) => {
        const [row] = await tx<{ role: string }[]>`SELECT current_setting('app.role', true) AS role`;
        return row.role;
      },
    );
    expect(role).toBe("admin");
  });
});
```

- [ ] **Step 3: index.ts re-export**

`packages/db-bootstrap/src/index.ts` 끝에:

```ts
// Plan 15c — RLS session context
export {
  type RlsSessionContext,
  type RlsTxRunner,
  EMPTY_RLS_CONTEXT,
  MAX_BITMAP_BYTES,
  BitmapTooLargeError,
  encodeBitmapHex,
  createRlsTxRunner,
} from "./rls-session.js";
```

- [ ] **Step 4: typecheck + 순수 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter db-bootstrap typecheck && \
  pnpm --filter db-bootstrap test -- rls-session
```

Expected: 4 순수 테스트 PASS + PG 4건 (env gate 시).

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/db-bootstrap/src/rls-session.ts \
          packages/db-bootstrap/src/rls-session.test.ts \
          packages/db-bootstrap/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(db-bootstrap): RlsSessionContext + createRlsTxRunner + encodeBitmapHex

sql.begin 기반 트랜잭션 스코프 SET LOCAL — connection pool 재사용 안전.
null 필드는 SET skip → helper 에서 NULL 로 처리 → default deny.
bitmap 크기 제한 128KB (spec §주의사항).
순수 4건 + PG 통합 4건 (env gate).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: rls-context-storage.ts — AsyncLocalStorage

**Files:**
- Create: `packages/db-bootstrap/src/rls-context-storage.ts`
- Create: `packages/db-bootstrap/src/rls-context-storage.test.ts`

NestJS Interceptor 가 request 단위로 context 를 저장 → service 레이어가 조회. 동시 요청 간 격리 보장은 Node `AsyncLocalStorage`.

- [ ] **Step 1: 파일 작성**

`packages/db-bootstrap/src/rls-context-storage.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import { AsyncLocalStorage } from "node:async_hooks";

import type { RlsSessionContext } from "./rls-session.js";
import { EMPTY_RLS_CONTEXT } from "./rls-session.js";

const storage = new AsyncLocalStorage<RlsSessionContext>();

/**
 * request 처리 콜백 동안 RlsSessionContext 를 binding.
 * interceptor 에서 요청 진입 시 호출, 내부 async 체인 어디서든 getCurrentRlsContext() 로 조회.
 */
export function withRlsContext<T>(ctx: RlsSessionContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * 현재 async 실행 스택의 RlsSessionContext.
 * interceptor 가 bind 하지 않은 경로에서는 EMPTY_RLS_CONTEXT 반환 — helper 는 NULL 로 처리해 default deny.
 */
export function getCurrentRlsContext(): RlsSessionContext {
  return storage.getStore() ?? EMPTY_RLS_CONTEXT;
}
```

- [ ] **Step 2: 동시성 격리 테스트**

`packages/db-bootstrap/src/rls-context-storage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { withRlsContext, getCurrentRlsContext } from "./rls-context-storage.js";
import { EMPTY_RLS_CONTEXT } from "./rls-session.js";

describe("rls-context-storage", () => {
  it("bind 없으면 EMPTY", () => {
    expect(getCurrentRlsContext()).toBe(EMPTY_RLS_CONTEXT);
  });

  it("bind 후 조회", async () => {
    await withRlsContext(
      { userId: "alice", tenantId: "acme", bitmapMask: null, role: null },
      async () => {
        const ctx = getCurrentRlsContext();
        expect(ctx.userId).toBe("alice");
      },
    );
    // 외부는 다시 EMPTY
    expect(getCurrentRlsContext().userId).toBeNull();
  });

  it("동시 다중 bind 격리", async () => {
    const results: string[] = [];
    await Promise.all([
      withRlsContext(
        { userId: "alice", tenantId: null, bitmapMask: null, role: null },
        async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(getCurrentRlsContext().userId ?? "null");
        },
      ),
      withRlsContext(
        { userId: "bob", tenantId: null, bitmapMask: null, role: null },
        async () => {
          await new Promise((r) => setTimeout(r, 1));
          results.push(getCurrentRlsContext().userId ?? "null");
        },
      ),
    ]);
    expect(results.sort()).toEqual(["alice", "bob"]);
  });
});
```

- [ ] **Step 3: index.ts re-export**

`packages/db-bootstrap/src/index.ts` 의 Plan 15c 섹션에 추가:

```ts
export { withRlsContext, getCurrentRlsContext } from "./rls-context-storage.js";
```

- [ ] **Step 4: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter db-bootstrap test -- rls-context-storage
```

Expected: 3 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/db-bootstrap/src/rls-context-storage.ts \
          packages/db-bootstrap/src/rls-context-storage.test.ts \
          packages/db-bootstrap/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(db-bootstrap): AsyncLocalStorage 기반 RLS context storage

withRlsContext / getCurrentRlsContext — 동시 요청 격리.
bind 없는 경로는 EMPTY_RLS_CONTEXT → default deny.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: rls-nest-interceptor.ts — NestJS 통합

**Files:**
- Modify: `packages/db-bootstrap/package.json` (optional peerDep)
- Create: `packages/db-bootstrap/src/rls-nest-interceptor.ts`
- Create: `packages/db-bootstrap/src/rls-nest-interceptor.test.ts`

request → JWT claim → `RlsSessionContext` 추출. JWT claim shape 은 sim-gateway (Plan 12a) + auth-api (Plan 11a) 의 표준 `{ sub, tenantId, bitmap: { version, mask_hex } }` 가정.

- [ ] **Step 1: peerDep 추가**

`packages/db-bootstrap/package.json` 의 `peerDependencies` 에 추가:

```json
  "peerDependencies": {
    "better-sqlite3": "catalog:",
    "postgres": "^3.4.0",
    "@nestjs/common": "^11.0.0",
    "rxjs": "^7.8.0"
  },
  "peerDependenciesMeta": {
    "better-sqlite3": { "optional": true },
    "postgres":       { "optional": true },
    "@nestjs/common": { "optional": true },
    "rxjs":           { "optional": true }
  },
```

`devDependencies` 에 `@nestjs/common` + `rxjs` 추가 (테스트용).

- [ ] **Step 2: interceptor 작성**

`packages/db-bootstrap/src/rls-nest-interceptor.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { Observable, from, lastValueFrom, defer, mergeMap } from "rxjs";

import type { RlsSessionContext } from "./rls-session.js";
import { withRlsContext } from "./rls-context-storage.js";

/**
 * JWT claim shape — sim-gateway + auth-api 공통.
 * sub         : userId
 * tenantId    : tenant 경계
 * bitmap.mask_hex : 타입 레벨 bitmap (hex TEXT, permission-engine VersionedBitmap.mask)
 * role        : 'admin' 이면 admin bypass (optional)
 */
export interface RlsJwtClaims {
  sub: string;
  tenantId?: string;
  bitmap?: { version?: string; mask_hex?: string };
  role?: string;
}

/** hex TEXT → Uint8Array */
export function decodeBitmapHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error(`bitmap hex odd length: ${clean.length}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function claimsToRlsContext(
  claims: RlsJwtClaims | null,
): RlsSessionContext {
  if (!claims) {
    return { userId: null, tenantId: null, bitmapMask: null, role: null };
  }
  let mask: Uint8Array | null = null;
  if (claims.bitmap?.mask_hex) {
    try {
      mask = decodeBitmapHex(claims.bitmap.mask_hex);
    } catch {
      mask = null; // 잘못된 hex → default deny
    }
  }
  return {
    userId: claims.sub ?? null,
    tenantId: claims.tenantId ?? null,
    bitmapMask: mask,
    role: claims.role === "admin" ? "admin" : null,
  };
}

/**
 * request.user (또는 request.auth) 에서 JWT claim 을 읽어 RlsSessionContext 로 변환 후
 * AsyncLocalStorage 에 bind. NestJS 전체 요청 처리 체인이 withRlsContext 안에서 실행됨.
 */
@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  constructor(
    private readonly options: {
      claimsAccessor?: (req: unknown) => RlsJwtClaims | null;
    } = {},
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ user?: RlsJwtClaims; auth?: RlsJwtClaims }>();
    const claims = this.options.claimsAccessor
      ? this.options.claimsAccessor(req)
      : (req.user ?? req.auth ?? null);
    const rlsCtx = claimsToRlsContext(claims);
    return defer(() => from(withRlsContext(rlsCtx, () => lastValueFrom(next.handle())))).pipe(
      mergeMap((value) => from(Promise.resolve(value))),
    );
  }
}
```

- [ ] **Step 3: interceptor 테스트**

`packages/db-bootstrap/src/rls-nest-interceptor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { of } from "rxjs";
import { lastValueFrom } from "rxjs";

import {
  RlsContextInterceptor,
  claimsToRlsContext,
  decodeBitmapHex,
} from "./rls-nest-interceptor.js";
import { getCurrentRlsContext } from "./rls-context-storage.js";

describe("decodeBitmapHex", () => {
  it("짝수 길이 hex → Uint8Array", () => {
    expect(Array.from(decodeBitmapHex("01ff"))).toEqual([0x01, 0xff]);
  });
  it("0x prefix 허용", () => {
    expect(Array.from(decodeBitmapHex("0x01"))).toEqual([0x01]);
  });
  it("홀수 길이 → throw", () => {
    expect(() => decodeBitmapHex("abc")).toThrow();
  });
});

describe("claimsToRlsContext", () => {
  it("null claims → 모두 null", () => {
    const ctx = claimsToRlsContext(null);
    expect(ctx.userId).toBeNull();
    expect(ctx.bitmapMask).toBeNull();
  });
  it("sub + tenantId + bitmap → context 정상", () => {
    const ctx = claimsToRlsContext({
      sub: "alice",
      tenantId: "acme",
      bitmap: { mask_hex: "01" },
    });
    expect(ctx.userId).toBe("alice");
    expect(ctx.tenantId).toBe("acme");
    expect(ctx.bitmapMask).toEqual(new Uint8Array([0x01]));
    expect(ctx.role).toBeNull();
  });
  it("role='admin' 인식", () => {
    const ctx = claimsToRlsContext({ sub: "adm", role: "admin" });
    expect(ctx.role).toBe("admin");
  });
  it("잘못된 bitmap hex → null (default deny)", () => {
    const ctx = claimsToRlsContext({ sub: "x", bitmap: { mask_hex: "zz" } });
    expect(ctx.bitmapMask).toBeNull();
  });
});

describe("RlsContextInterceptor", () => {
  it("request.user → AsyncLocalStorage bind 후 handle 결과 반환", async () => {
    const interceptor = new RlsContextInterceptor();
    let observed: ReturnType<typeof getCurrentRlsContext> | null = null;
    const execCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "alice", tenantId: "acme" } }),
      }),
    } as never;
    const next = {
      handle: () => {
        observed = getCurrentRlsContext();
        return of("OK");
      },
    } as never;
    const result = await lastValueFrom(interceptor.intercept(execCtx, next));
    expect(result).toBe("OK");
    expect(observed!.userId).toBe("alice");
    expect(observed!.tenantId).toBe("acme");
  });

  it("claims 없으면 default (null) context", async () => {
    const interceptor = new RlsContextInterceptor();
    let observed: ReturnType<typeof getCurrentRlsContext> | null = null;
    const execCtx = { switchToHttp: () => ({ getRequest: () => ({}) }) } as never;
    const next = {
      handle: () => {
        observed = getCurrentRlsContext();
        return of("OK");
      },
    } as never;
    await lastValueFrom(interceptor.intercept(execCtx, next));
    expect(observed!.userId).toBeNull();
  });

  it("claimsAccessor 옵션 override", async () => {
    const interceptor = new RlsContextInterceptor({
      claimsAccessor: () => ({ sub: "bob" }),
    });
    let observed: ReturnType<typeof getCurrentRlsContext> | null = null;
    const execCtx = { switchToHttp: () => ({ getRequest: () => ({}) }) } as never;
    const next = {
      handle: () => {
        observed = getCurrentRlsContext();
        return of("OK");
      },
    } as never;
    await lastValueFrom(interceptor.intercept(execCtx, next));
    expect(observed!.userId).toBe("bob");
  });
});
```

- [ ] **Step 4: index.ts re-export**

```ts
export {
  RlsContextInterceptor,
  claimsToRlsContext,
  decodeBitmapHex,
  type RlsJwtClaims,
} from "./rls-nest-interceptor.js";
```

- [ ] **Step 5: pnpm install + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  pnpm --filter db-bootstrap typecheck && \
  pnpm --filter db-bootstrap test -- rls-nest-interceptor
```

Expected: typecheck OK + 10 interceptor 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/db-bootstrap/package.json \
          packages/db-bootstrap/src/rls-nest-interceptor.ts \
          packages/db-bootstrap/src/rls-nest-interceptor.test.ts \
          packages/db-bootstrap/src/index.ts \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(db-bootstrap): RlsContextInterceptor — JWT claim → AsyncLocalStorage

claimsToRlsContext + decodeBitmapHex 순수 유틸.
NestJS Interceptor 로 각 서비스에 1 라인 주입 — request 진입 시 context bind.
@nestjs/common / rxjs 는 peerDep optional.
10 단위 테스트 (hex decode / claim 변환 / interceptor integration).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: rls-aware-adapter.ts — 호출측 migration 데모

**Files:**
- Create: `packages/resource-policy-store/src/pg/rls-aware-adapter.ts`
- Create: `packages/resource-policy-store/src/pg/rls-aware-adapter.test.ts`
- Modify: `packages/resource-policy-store/package.json` (db-bootstrap dep)
- Modify: `packages/resource-policy-store/src/index.ts`

1 개 adapter 를 RLS-aware 래퍼로 demo — 나머지 store 의 마이그레이션 패턴 고정.

- [ ] **Step 1: package.json 갱신**

`packages/resource-policy-store/package.json` 의 `dependencies` 에 `db-bootstrap` 추가:

```json
  "dependencies": {
    "db-bootstrap": "workspace:*",
    "drizzle-orm": "catalog:",
    "permission-engine": "workspace:*",
    "weighted-index": "workspace:*"
  },
```

- [ ] **Step 2: rls-aware-adapter.ts 작성**

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";

import {
  createRlsTxRunner,
  getCurrentRlsContext,
  type RlsTxRunner,
  type RlsSessionContext,
} from "db-bootstrap";

import { PgResourcePolicyRegistry } from "./adapter.js";
import type { ResourcePolicy, ResourcePolicyRegistry, ResourcePolicyState, ResourcePolicyCreateArgs, ResourcePolicyDelegateArgs, ResourcePolicyRegisterArgs } from "permission-engine";

/**
 * PgResourcePolicyRegistry 를 감싸는 RLS-aware 래퍼.
 *
 * 모든 호출을 RlsTxRunner 로 래핑 — 현재 AsyncLocalStorage 의 context (혹은 explicit ctx) 주입 후 실행.
 * interceptor 없는 경로(CLI 등) 는 overrideContext 인자로 명시적 지정.
 */
export class RlsAwarePgResourcePolicyRegistry implements ResourcePolicyRegistry {
  private readonly runner: RlsTxRunner;

  constructor(
    private readonly sql: Sql,
    private readonly overrideContext?: RlsSessionContext,
  ) {
    this.runner = createRlsTxRunner(sql);
  }

  private ctx(): RlsSessionContext {
    return this.overrideContext ?? getCurrentRlsContext();
  }

  private inner(tx: PostgresJsDatabase): PgResourcePolicyRegistry {
    return new PgResourcePolicyRegistry(tx);
  }

  async resolve(resourceId: string): Promise<ResourcePolicy | null> {
    return this.runner(this.ctx(), async (tx) => this.inner(drizzle(tx)).resolve(resourceId));
  }
  async create(args: ResourcePolicyCreateArgs): Promise<ResourcePolicy> {
    return this.runner(this.ctx(), async (tx) => this.inner(drizzle(tx)).create(args));
  }
  async register(resourceId: string, args: ResourcePolicyRegisterArgs): Promise<ResourcePolicy> {
    return this.runner(this.ctx(), async (tx) => this.inner(drizzle(tx)).register(resourceId, args));
  }
  async delegate(resourceId: string, args: ResourcePolicyDelegateArgs): Promise<ResourcePolicy> {
    return this.runner(this.ctx(), async (tx) => this.inner(drizzle(tx)).delegate(resourceId, args));
  }
  async remove(resourceId: string): Promise<void> {
    await this.runner(this.ctx(), async (tx) => this.inner(drizzle(tx)).remove(resourceId));
  }
  async listByOwner(ownerId: string): Promise<ResourcePolicy[]> {
    return this.runner(this.ctx(), async (tx) => this.inner(drizzle(tx)).listByOwner(ownerId));
  }
  async listByState(state: ResourcePolicyState): Promise<ResourcePolicy[]> {
    return this.runner(this.ctx(), async (tx) => this.inner(drizzle(tx)).listByState(state));
  }
}
```

- [ ] **Step 3: 테스트 작성**

`packages/resource-policy-store/src/pg/rls-aware-adapter.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { withRlsContext } from "db-bootstrap";
import { RESOURCE_POLICIES_PG_DDL } from "./schema.js";
import { RP_READ_BIT, RP_WRITE_BIT } from "./rls-bits.js";
import { RlsAwarePgResourcePolicyRegistry } from "./rls-aware-adapter.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

function maskWithBit(pos: number): Uint8Array {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const out = new Uint8Array(byteIdx + 1);
  out[byteIdx] = 1 << bitIdx;
  return out;
}

describe.skipIf(!PG_AVAILABLE)("RlsAwarePgResourcePolicyRegistry — Plan 15c", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const AUTH_APP_PASSWORD = process.env.QA_TEST_PG_AUTH_APP_PASSWORD ?? "";
  const ADMIN_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;
  let testSchema: string;
  let registry: RlsAwarePgResourcePolicyRegistry;

  beforeEach(async () => {
    testSchema = `aware_${randomBytes(4).toString("hex")}`;
    adminSql = postgres({ host: PG_HOST, port: PG_PORT, database: PG_DATABASE, user: "qa_admin", password: ADMIN_PASSWORD, max: 3, onnotice: () => {} });
    const ddl = RESOURCE_POLICIES_PG_DDL
      .replaceAll("auth.resource_policies", `${testSchema}.resource_policies`)
      .replace("CREATE SCHEMA IF NOT EXISTS auth", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      .replaceAll("ON auth.resource_policies", `ON ${testSchema}.resource_policies`);
    await adminSql.unsafe(ddl);
    await adminSql.unsafe(`GRANT USAGE ON SCHEMA ${testSchema} TO auth_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${testSchema}.resource_policies TO auth_app`);
    appSql = postgres({ host: PG_HOST, port: PG_PORT, database: PG_DATABASE, user: "auth_app", password: AUTH_APP_PASSWORD, max: 3, onnotice: () => {} });
    await appSql`SET search_path TO ${appSql(testSchema)}, public`;
    registry = new RlsAwarePgResourcePolicyRegistry(appSql);
  });

  afterEach(async () => {
    try { await adminSql.unsafe(`DROP SCHEMA ${testSchema} CASCADE`); } finally {
      await adminSql.end(); await appSql.end();
    }
  });

  it("ALS context 없으면 default deny (SELECT 0 row)", async () => {
    await adminSql.unsafe(`INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`);
    const rows = await registry.listByOwner("alice");
    expect(rows.length).toBe(0);
  });

  it("ALS context 주입 후 호출 — owner policy 통과", async () => {
    await adminSql.unsafe(`INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`);
    const rows = await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: maskWithBit(RP_READ_BIT), role: null },
      () => registry.listByOwner("alice"),
    );
    expect(rows.length).toBe(1);
  });

  it("explicit overrideContext", async () => {
    await adminSql.unsafe(`INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`);
    const cliRegistry = new RlsAwarePgResourcePolicyRegistry(appSql, {
      userId: "alice", tenantId: null, bitmapMask: maskWithBit(RP_READ_BIT), role: null,
    });
    const rows = await cliRegistry.listByOwner("alice");
    expect(rows.length).toBe(1);
  });

  it("create — WITH CHECK 정책 통과", async () => {
    await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: maskWithBit(RP_WRITE_BIT), role: null },
      async () => {
        await registry.create({ resourceId: "new-r", resourceType: "doc", ownerId: "alice" });
      },
    );
    const rows = await adminSql`SELECT resource_id FROM ${adminSql(testSchema)}.resource_policies WHERE resource_id='new-r'`;
    expect(rows.length).toBe(1);
  });

  it("admin bypass — role='admin' context → REGISTERED 리소스도 보임", async () => {
    await adminSql.unsafe(`INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-reg', 'doc', 'REGISTERED', 'alice', '2026-04-22')`);
    const rows = await withRlsContext(
      { userId: null, tenantId: null, bitmapMask: null, role: "admin" },
      () => registry.listByState("REGISTERED"),
    );
    expect(rows.length).toBe(1);
  });
});
```

- [ ] **Step 4: index.ts re-export**

`packages/resource-policy-store/src/index.ts` 끝에:

```ts
// Plan 15c — RLS-aware 래퍼
export { RlsAwarePgResourcePolicyRegistry } from "./pg/rls-aware-adapter.js";
```

- [ ] **Step 5: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  pnpm --filter resource-policy-store typecheck && \
  QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_AUTH_APP_PASSWORD=$(grep '^QA_SDK_AUTH_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store test -- rls-aware 2>&1 | tail -10
```

Expected: 5 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/package.json \
          packages/resource-policy-store/src/pg/rls-aware-adapter.ts \
          packages/resource-policy-store/src/pg/rls-aware-adapter.test.ts \
          packages/resource-policy-store/src/index.ts \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(resource-policy-store): RlsAwarePgResourcePolicyRegistry 래퍼

PgResourcePolicyRegistry 를 createRlsTxRunner 로 감싼 adapter.
AsyncLocalStorage (interceptor) + explicit override 두 경로 지원.
RLS 정책 통과·차단·admin bypass 통합 테스트 5종.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀 + 문서

- [ ] **Step 1: db-bootstrap 전체 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter db-bootstrap test 2>&1 | tail -10
```

Expected: Plan 04c baseline + Plan 15c 신규 모두 PASS.

- [ ] **Step 2: resource-policy-store 전체 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -10
```

Expected: SQLite + PG 기존 + RLS aware 신규 모두 PASS (env gate 에 따라).

- [ ] **Step 3: dependents typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^db-bootstrap" typecheck 2>&1 | tail -5
```

Expected: 에러 없음 — db-bootstrap 을 import 하는 패키지 (audit-recorder-store, ingest-server 등) 영향 없음.

- [ ] **Step 4: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -3
```

Expected: errors 0.

---

## Self-Review

- [ ] `RlsSessionContext` + `createRlsTxRunner` 가 `sql.begin` 트랜잭션 안에서 SET LOCAL 수행
- [ ] null 필드는 SET skip → helper 에서 NULL → default deny (spec §주의사항 "SET LOCAL 누락 방어" 이행)
- [ ] `encodeBitmapHex` / `decodeBitmapHex` round-trip + 128KB 제한
- [ ] AsyncLocalStorage 기반 `withRlsContext` / `getCurrentRlsContext` — 동시 요청 격리
- [ ] NestJS `RlsContextInterceptor` — JWT claim → context bind, 기본 claimsAccessor = `req.user ?? req.auth`
- [ ] `RlsAwarePgResourcePolicyRegistry` 가 AsyncLocalStorage·explicit override 양쪽 지원
- [ ] admin bypass 는 claim role='admin' 에서만 활성
- [ ] 비파괴적 migration — 기존 `PgResourcePolicyRegistry` signature 유지
- [ ] 27 단위 테스트 (순수 8 + PG 통합 19) — 기존 테스트 회귀 0

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| 나머지 store (audit-recorder-store, ingest-server) 에 RLS-aware 래퍼 적용 | 패턴 확립 후 반복 작업 | Plan 15c 후속 또는 Plan 15e 포함 |
| sim-gateway / sim-auth-api 등 서비스에 interceptor 부착 | simulation Phase 4 범위 — Plan 14a 연계 | 14a 후속 |
| bitmap cache invalidation (version 갱신 시 ALS context refresh) | Plan 12b (bitmap-pubsub-invalidation) 와 통합 | 통합 plan |
| CLI 사용자 명령에 admin bypass 자동 주입 | 운영 도입 | Phase 5 후속 |
| RLS shadow 로깅 hook (interceptor 에서 deny 횟수 수집) | Plan 15d 범위 | Plan 15d |

---

## 의존·후속

- **Plan 04c (db-bootstrap)**: 본 plan 이 패키지에 신규 파일을 추가하므로 Plan 04c 완료 필수.
- **Plan 15a (helper functions)**: `createRlsTxRunner` 가 주입하는 GUC 를 helper 가 읽음.
- **Plan 15b (policy templates)**: 본 plan 이 구축한 context 경로가 15b 정책이 요구하는 값의 공급자.
- **Plan 15d (shadow mode)**: 본 plan 의 interceptor 에 deny 로깅 hook 추가.
- **Plan 15e (enforce mode)**: 본 plan 의 interceptor 가 admin bypass 경로를 활성화.
- **Plan 11a (sim-auth-api)**, **Plan 12a (sim-gateway)**: JWT claim shape 준수 — 본 plan 의 `RlsJwtClaims` 는 위 두 plan 의 표준과 일치 가정.
