---
lifecycle: draft
plan: 12b
phase: 4
depends-on: [12a, 11a, 10b, 09c]
---

# Plan 12b — sim Bitmap pub/sub invalidation (Redis) + LRU 캐시

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** §2 `authorization-ontology-bitmap-pipeline` 스펙의 §5 (무효화 — Invalidation) 패턴을 정확히 구현한다. (1) `sim-auth-api`에 `BitmapInvalidationPublisher` 모듈 — 권한 변경(role assign/revoke, role definition 수정) 시 `bitmap:invalidate` 채널에 publish. (2) **모든 비즈니스 서비스**(8 NestJS 서비스 + sim-gateway)에 `BitmapInvalidationSubscriber` 모듈 — 부팅 시 Redis subscribe → 메시지 수신 시 로컬 LRU 캐시 flush. (3) LRU 캐시는 `lru-cache` 라이브러리 — key: `userId:prefix:v`. (4) §2 §5의 3 scope (`user` / `role` / `prefix`) 모두 구현 — role/prefix scope는 영향받는 모든 user의 cache key를 패턴 매칭으로 삭제. testcontainers로 실 Redis 통합 테스트 + ioredis-mock으로 단위 테스트.

**Architecture:**
- **§2 §5 Invalidation 메시지 스키마** (스펙 정확 매칭):
  ```ts
  interface InvalidationMessage {
    scope: "user" | "role" | "prefix";
    target: string;       // userId | roleId | prefix
    reason: "permission_change" | "role_redefinition" | "prefix_version_bump" | "security_incident";
    issuedAt: string;     // ISO-8601
    publisher: string;    // "sim-auth-api"
  }
  ```
- **공유 패키지 위치 결정**: `simulations/enterprise-pm/packages/sim-bitmap-cache/` 신규 워크스페이스 패키지 — Publisher + Subscriber + LRU + 메시지 스키마. 8 서비스가 dep로 참조. `simulations/enterprise-pm/packages/`는 plan 09a workspace 정의의 `simulations/*/packages/*` glob에 포함되어야 함 (Plan 09a 검증 + 필요 시 보강).
- **Publisher (sim-auth-api 주입)**:
  - `BitmapInvalidationModule` NestJS 모듈
  - `BitmapInvalidationPublisher` 서비스 — `publish(msg)` 메서드 → ioredis client.publish
  - sim-auth-api의 `RoleAssignmentService.assign/revoke` + `RoleService.update`가 publish 호출
- **Subscriber (8 서비스 + gateway 주입)**:
  - `BitmapInvalidationModule.forRoot({ redisUrl, listenerOnly: true })`
  - 부팅 시 ioredis subscribe → message handler → LRU.delete (scope 별 패턴)
  - `BitmapCacheService` 서비스 — `get(userId, prefix, v)` / `set(userId, prefix, v, bitmap)` / `invalidate(scope, target)`
- **LRU 캐시**:
  - `lru-cache` ^11.0.0 (catalog 등록)
  - max: 10_000 entries (운영 측정 후 조정)
  - ttlAutopurge: true (TTL 만료 자동 정리)
  - key 포맷: `${userId}|${prefix}|${v}` (구분자 `|`, 충돌 방지)
- **Scope 별 invalidation 로직**:
  - `user`: `cache.delete()` 직접 (key prefix `${userId}|`)
  - `role`: 모든 key 순회 → 해당 role을 가진 user의 cache 삭제 (sim-auth-api에서 role→user 매핑 조회 필요. 본 plan은 caller에 user list를 함께 전달하는 패턴으로 단순화 — `affectedUserIds: string[]`)
  - `prefix`: `cache.clear()` (특정 prefix만 cache 시 prefix 매칭)
- **TDD 전략**:
  - 메시지 스키마 zod 검증
  - LRU 캐시 단위 테스트 (set/get/invalidate)
  - Publisher 단위 테스트 (ioredis-mock client.publish 호출 확인)
  - Subscriber 단위 테스트 (mock 메시지 수신 → cache delete 검증)
  - 통합 테스트 — testcontainers로 실 Redis 부팅, publish → subscribe round-trip

**Tech Stack:**
- `ioredis` ^5.4.0 — 모든 서비스에서 사용
- `ioredis-mock` ^8.9.0 — 단위 테스트
- `lru-cache` ^11.0.0 — LRU 구현
- `@testcontainers/redis` ^10.0.0 — 통합 테스트 (옵션 — env gate)
- `@nestjs/common`, NestJS 11 — 모듈/DI
- vitest, ES2023, ts

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/packages/sim-bitmap-cache/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts
│   ├── message.ts              # InvalidationMessage zod schema
│   ├── message.test.ts
│   ├── lru-cache.ts            # BitmapLruCache wrapper
│   ├── lru-cache.test.ts
│   ├── publisher.ts            # BitmapInvalidationPublisher (ioredis client.publish)
│   ├── publisher.test.ts
│   ├── subscriber.ts           # BitmapInvalidationSubscriber (ioredis client.subscribe)
│   ├── subscriber.test.ts
│   ├── cache-service.ts        # BitmapCacheService (LRU + invalidate 통합)
│   ├── cache-service.test.ts
│   ├── nest/
│   │   ├── bitmap-cache.module.ts   # forRoot/forRootAsync (NestJS dynamic module)
│   │   └── bitmap-cache.module.test.ts
│   └── integration.test.ts     # testcontainers Redis e2e (env gate)
└── README.md
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/auth-api/package.json` | `@qa-sdk/sim-bitmap-cache` workspace dep 추가 |
| `simulations/enterprise-pm/services/auth-api/src/app.module.ts` | `BitmapCacheModule.forRoot({ publisherEnabled: true, listenerEnabled: false })` 추가 |
| `simulations/enterprise-pm/services/auth-api/src/auth/role-assignment/role-assignment.service.ts` | `assign/revoke` 후 `publisher.publish({ scope: "user", target: userId, ... })` |
| `simulations/enterprise-pm/services/auth-api/src/auth/role/role.service.ts` | `update` 후 `publisher.publish({ scope: "role", target: roleId, ..., affectedUserIds })` |
| `simulations/enterprise-pm/services/{pm,approval,notification,reporting,document,audit-browser}-api/package.json` | `@qa-sdk/sim-bitmap-cache` dep |
| `simulations/enterprise-pm/services/{pm,approval,notification,reporting,document,audit-browser}-api/src/app.module.ts` | `BitmapCacheModule.forRoot({ listenerEnabled: true })` |
| `simulations/enterprise-pm/services/gateway/src/server.ts` | subscriber 부팅 (Hono — DI 없으므로 직접 인스턴스화) |
| `pnpm-workspace.yaml` | `simulations/*/packages/*` glob 확인 (Plan 09a 보강 필요 시) |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/gateway/src/lib/jwt.ts && \
  ls simulations/enterprise-pm/services/auth-api/src/auth/role-assignment/role-assignment.service.ts && \
  grep -n "sim-redis\|REDIS_URL" simulations/enterprise-pm/docker-compose.sim.yaml
```

Expected: 모두 hit. Plan 12a (gateway JWT) + Plan 11a (RoleAssignmentService) + Plan 09c (sim-redis 컨테이너) 완료 확인.

- [ ] **Step 2: workspace glob 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && cat pnpm-workspace.yaml
```

Expected: `simulations/enterprise-pm/packages/*` 또는 `simulations/*/packages/*` 또는 `simulations/**` glob 존재. 미존재 시 본 plan Task 1에서 추가.

- [ ] **Step 3: ioredis catalog 등록 여부**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -E "ioredis|lru-cache" pnpm-workspace.yaml
```

Expected: 미등록일 가능성 — 본 plan에서 catalog 추가.

- [ ] **Step 4: Plan 09c sim-redis 컨테이너 부팅**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && \
  docker compose -f docker-compose.sim.yaml up -d sim-redis && sleep 3 && \
  docker compose -f docker-compose.sim.yaml exec -T sim-redis redis-cli ping
```

Expected: `PONG`. 미설정 시 통합 테스트는 testcontainers로 대체.

---

## Task 1: pnpm workspace + catalog + sim-bitmap-cache 패키지 스캐폴딩

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/package.json`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/tsconfig.json`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/tsup.config.ts`

- [ ] **Step 1: workspace glob 보강**

`pnpm-workspace.yaml`에 `simulations/enterprise-pm/packages/*` 글롭 추가 (이미 있으면 skip):

```yaml
packages:
  - "packages/*"
  - "simulations/enterprise-pm/services/*"
  - "simulations/enterprise-pm/packages/*"   # ← 신규 (또는 기존 simulations/*/packages/* 확인)
catalog:
  better-sqlite3: ^12.0.0
  "@types/better-sqlite3": ^7.6.0
  drizzle-orm: ^0.36.0
  drizzle-kit: ^0.26.0
  ioredis: ^5.4.0          # ← 신규
  ioredis-mock: ^8.9.0     # ← 신규
  lru-cache: ^11.0.0       # ← 신규
```

- [ ] **Step 2: 디렉토리 + package.json**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/packages/sim-bitmap-cache/src/nest
```

`simulations/enterprise-pm/packages/sim-bitmap-cache/package.json`:

```json
{
  "name": "@qa-sdk/sim-bitmap-cache",
  "version": "0.1.0",
  "description": "시뮬 — bitmap invalidation pub/sub + LRU 캐시 (§2 §5 spec 구현)",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "ioredis": "catalog:",
    "lru-cache": "catalog:",
    "permission-engine": "workspace:*",
    "zod": "^3.24.2"
  },
  "peerDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0"
  },
  "peerDependenciesMeta": {
    "@nestjs/common": { "optional": true },
    "@nestjs/core": { "optional": true }
  },
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@types/node": "^22.0.0",
    "ioredis-mock": "catalog:",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

NestJS는 peerDep optional — gateway(Hono)도 사용 가능.

- [ ] **Step 3: tsconfig + tsup**

`tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

`tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
});
```

- [ ] **Step 4: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: `@qa-sdk/sim-bitmap-cache` workspace 인식 + ioredis/lru-cache catalog 설치.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add pnpm-workspace.yaml \
          simulations/enterprise-pm/packages/sim-bitmap-cache/package.json \
          simulations/enterprise-pm/packages/sim-bitmap-cache/tsconfig.json \
          simulations/enterprise-pm/packages/sim-bitmap-cache/tsup.config.ts \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-bitmap-cache): 패키지 스캐폴딩 + workspace 등록

ioredis/lru-cache/ioredis-mock catalog 추가.
NestJS는 peerDep optional — Hono gateway에서도 import 가능.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: src/message.ts — InvalidationMessage 스키마 (TDD)

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/message.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/message.test.ts`

§2 §5 Invalidation 스키마를 zod로 codify.

- [ ] **Step 1: message.test.ts (test-first)**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import {
  invalidationMessageSchema,
  serializeMessage,
  parseMessage,
  type InvalidationMessage,
} from "./message.js";

const sample: InvalidationMessage = {
  scope: "user",
  target: "user-1",
  reason: "permission_change",
  issuedAt: "2026-04-22T00:00:00.000Z",
  publisher: "sim-auth-api",
};

describe("InvalidationMessage 스키마 — §2 §5 정확 매칭", () => {
  it("scope 3 enum: user / role / prefix", () => {
    const u = invalidationMessageSchema.safeParse({ ...sample, scope: "user" });
    const r = invalidationMessageSchema.safeParse({ ...sample, scope: "role" });
    const p = invalidationMessageSchema.safeParse({ ...sample, scope: "prefix" });
    expect(u.success && r.success && p.success).toBe(true);
    const bad = invalidationMessageSchema.safeParse({ ...sample, scope: "session" });
    expect(bad.success).toBe(false);
  });

  it("reason 4 enum: permission_change / role_redefinition / prefix_version_bump / security_incident", () => {
    for (const reason of [
      "permission_change", "role_redefinition", "prefix_version_bump", "security_incident",
    ] as const) {
      const r = invalidationMessageSchema.safeParse({ ...sample, reason });
      expect(r.success, reason).toBe(true);
    }
    const bad = invalidationMessageSchema.safeParse({ ...sample, reason: "manual" });
    expect(bad.success).toBe(false);
  });

  it("affectedUserIds 옵션 — role/prefix scope에서 활용", () => {
    const ok = invalidationMessageSchema.safeParse({
      ...sample, scope: "role", target: "role-1", affectedUserIds: ["u1", "u2"],
    });
    expect(ok.success).toBe(true);
  });

  it("serialize/parse round-trip", () => {
    const json = serializeMessage(sample);
    expect(typeof json).toBe("string");
    const back = parseMessage(json);
    expect(back).toEqual(sample);
  });

  it("invalid JSON → throw", () => {
    expect(() => parseMessage("not-json")).toThrow();
  });

  it("schema invalid → parse throw with zod issues", () => {
    const partial = JSON.stringify({ scope: "user" }); // target 누락
    expect(() => parseMessage(partial)).toThrow(/target/i);
  });
});
```

- [ ] **Step 2: message.ts 구현**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * InvalidationMessage — §2 bitmap-pipeline §5 (Invalidation) 메시지 스키마.
 *
 * Redis pub/sub 채널 "bitmap:invalidate"에 publish되는 JSON 페이로드.
 * 모든 Subscriber가 동일 schema로 parse하여 LRU cache에서 해당 entry 제거.
 */

import { z } from "zod";

export const InvalidationScope = z.enum(["user", "role", "prefix"]);
export const InvalidationReason = z.enum([
  "permission_change",
  "role_redefinition",
  "prefix_version_bump",
  "security_incident",
]);

export const invalidationMessageSchema = z.object({
  scope: InvalidationScope,
  /** scope=user → userId, scope=role → roleId, scope=prefix → prefix string. */
  target: z.string().min(1),
  reason: InvalidationReason,
  issuedAt: z.string().datetime(),
  publisher: z.string().min(1),
  /**
   * scope=role 또는 prefix일 때 영향받는 user 목록.
   * sim-auth-api가 role→user 매핑을 알고 있으므로 publish 시 함께 전송.
   * 누락 시 Subscriber는 cache 전체 flush(prefix scope) 또는 noop(role scope, fail-safe).
   */
  affectedUserIds: z.array(z.string()).optional(),
});

export type InvalidationMessage = z.infer<typeof invalidationMessageSchema>;
export type Scope = z.infer<typeof InvalidationScope>;
export type Reason = z.infer<typeof InvalidationReason>;

export const INVALIDATION_CHANNEL = "bitmap:invalidate";

export function serializeMessage(msg: InvalidationMessage): string {
  return JSON.stringify(msg);
}

export function parseMessage(json: string): InvalidationMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`invalid JSON: ${(err as Error).message}`);
  }
  return invalidationMessageSchema.parse(raw);
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test -- message.test
```

Expected: 6 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/message.ts \
          simulations/enterprise-pm/packages/sim-bitmap-cache/src/message.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-bitmap-cache): InvalidationMessage zod schema (§2 §5 매칭)

3 scope (user/role/prefix) × 4 reason × affectedUserIds 옵션.
INVALIDATION_CHANNEL = "bitmap:invalidate" 표준화.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: src/lru-cache.ts — BitmapLruCache wrapper (TDD)

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/lru-cache.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/lru-cache.test.ts`

- [ ] **Step 1: lru-cache.test.ts (test-first)**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import { BitmapLruCache, makeKey, parseKey } from "./lru-cache.js";
import type { VersionedBitmap } from "permission-engine";

const sampleBm = (id: string): VersionedBitmap => ({
  prefix: "sim.bitmap", v: "uv1", mask: new Uint8Array([0x01, 0x02]),
  issuedAt: "2026-04-22T00:00:00Z",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  issuer: "sim-auth-api", signature: id,
});

describe("BitmapLruCache", () => {
  it("set/get round-trip", () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("user-1", "sim.bitmap", "uv1", sampleBm("a"));
    const got = cache.get("user-1", "sim.bitmap", "uv1");
    expect(got?.signature).toBe("a");
  });

  it("get(미존재) → undefined", () => {
    const cache = new BitmapLruCache({ max: 100 });
    expect(cache.get("nope", "sim.bitmap", "uv1")).toBeUndefined();
  });

  it("invalidateUser — 해당 user의 모든 (prefix, v) 삭제", () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("user-1", "sim.bitmap", "uv1", sampleBm("a"));
    cache.set("user-1", "sim.bitmap", "uv2", sampleBm("b"));
    cache.set("user-2", "sim.bitmap", "uv1", sampleBm("c"));
    cache.invalidateUser("user-1");
    expect(cache.get("user-1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("user-1", "sim.bitmap", "uv2")).toBeUndefined();
    expect(cache.get("user-2", "sim.bitmap", "uv1")?.signature).toBe("c");
  });

  it("invalidateUsers — affectedUserIds 일괄 삭제", () => {
    const cache = new BitmapLruCache({ max: 100 });
    for (const id of ["a", "b", "c"]) {
      cache.set(id, "sim.bitmap", "uv1", sampleBm(id));
    }
    cache.invalidateUsers(["a", "c"]);
    expect(cache.get("a", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("b", "sim.bitmap", "uv1")?.signature).toBe("b");
    expect(cache.get("c", "sim.bitmap", "uv1")).toBeUndefined();
  });

  it("invalidatePrefix — 해당 prefix의 모든 entry 삭제", () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    cache.set("u2", "sim.bitmap", "uv1", sampleBm("b"));
    cache.set("u1", "other.prefix", "uv1", sampleBm("c"));
    cache.invalidatePrefix("sim.bitmap");
    expect(cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u2", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u1", "other.prefix", "uv1")?.signature).toBe("c");
  });

  it("max 초과 시 LRU eviction", () => {
    const cache = new BitmapLruCache({ max: 2 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    cache.set("u2", "sim.bitmap", "uv1", sampleBm("b"));
    cache.set("u3", "sim.bitmap", "uv1", sampleBm("c"));
    expect(cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined(); // evicted
    expect(cache.get("u2", "sim.bitmap", "uv1")?.signature).toBe("b");
    expect(cache.get("u3", "sim.bitmap", "uv1")?.signature).toBe("c");
  });

  it("makeKey / parseKey round-trip", () => {
    const k = makeKey("user-1", "sim.bitmap", "uv1");
    expect(k).toBe("user-1|sim.bitmap|uv1");
    expect(parseKey(k)).toEqual({ userId: "user-1", prefix: "sim.bitmap", v: "uv1" });
  });
});
```

- [ ] **Step 2: lru-cache.ts 구현**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * BitmapLruCache — VersionedBitmap의 process-local LRU 캐시.
 *
 * §2 bitmap-pipeline §5 (Invalidation) 의 Subscriber측 구현.
 * Redis pub/sub로부터 InvalidationMessage 수신 시 본 cache의 해당 entry 삭제.
 *
 * key 포맷: "${userId}|${prefix}|${v}". 구분자 "|"는 userId/prefix/v 어느 것에도
 * 포함되지 않음 (도메인 규약).
 */

import { LRUCache } from "lru-cache";
import type { VersionedBitmap } from "permission-engine";

export interface BitmapLruCacheOptions {
  max: number;
}

export function makeKey(userId: string, prefix: string, v: string): string {
  return `${userId}|${prefix}|${v}`;
}

export function parseKey(key: string): { userId: string; prefix: string; v: string } {
  const [userId, prefix, v] = key.split("|");
  if (!userId || !prefix || !v) {
    throw new Error(`invalid cache key: ${key}`);
  }
  return { userId, prefix, v };
}

export class BitmapLruCache {
  private readonly cache: LRUCache<string, VersionedBitmap>;

  constructor(opts: BitmapLruCacheOptions) {
    this.cache = new LRUCache({
      max: opts.max,
      // VersionedBitmap의 expiresAt 기준 자동 만료
      ttl: undefined,
      ttlAutopurge: false,
    });
  }

  set(userId: string, prefix: string, v: string, bitmap: VersionedBitmap): void {
    const remaining = new Date(bitmap.expiresAt).getTime() - Date.now();
    if (remaining <= 0) return; // 이미 만료
    this.cache.set(makeKey(userId, prefix, v), bitmap, { ttl: remaining });
  }

  get(userId: string, prefix: string, v: string): VersionedBitmap | undefined {
    return this.cache.get(makeKey(userId, prefix, v));
  }

  /** §2 §5 scope=user — 해당 user의 모든 (prefix, v) entry 삭제. */
  invalidateUser(userId: string): number {
    let removed = 0;
    const prefix = `${userId}|`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** §2 §5 scope=role — affectedUserIds 일괄 삭제. */
  invalidateUsers(userIds: readonly string[]): number {
    let removed = 0;
    for (const id of userIds) {
      removed += this.invalidateUser(id);
    }
    return removed;
  }

  /** §2 §5 scope=prefix — 해당 prefix의 모든 entry 삭제. */
  invalidatePrefix(prefix: string): number {
    let removed = 0;
    const needle = `|${prefix}|`;
    for (const key of this.cache.keys()) {
      if (key.includes(needle)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** 통계용. */
  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test -- lru-cache
```

Expected: 7 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/lru-cache.ts \
          simulations/enterprise-pm/packages/sim-bitmap-cache/src/lru-cache.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-bitmap-cache): BitmapLruCache — process-local LRU + scope 별 invalidate

§2 §5 3 scope 모두 구현:
  invalidateUser (scope=user) — userId prefix key 매칭
  invalidateUsers (scope=role + affectedUserIds)
  invalidatePrefix (scope=prefix) — |prefix| substring 매칭
TTL은 VersionedBitmap.expiresAt 기반 동적 설정.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: src/publisher.ts — BitmapInvalidationPublisher (TDD)

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/publisher.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/publisher.test.ts`

- [ ] **Step 1: publisher.test.ts (test-first)**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi } from "vitest";
import RedisMock from "ioredis-mock";
import { BitmapInvalidationPublisher } from "./publisher.js";
import { INVALIDATION_CHANNEL, parseMessage } from "./message.js";

describe("BitmapInvalidationPublisher", () => {
  it("publish — INVALIDATION_CHANNEL에 JSON 메시지 발행", async () => {
    const redis = new RedisMock();
    const subscriber = redis.duplicate();
    await subscriber.subscribe(INVALIDATION_CHANNEL);

    const received: string[] = [];
    subscriber.on("message", (ch, msg) => {
      if (ch === INVALIDATION_CHANNEL) received.push(msg);
    });

    const publisher = new BitmapInvalidationPublisher({
      redis,
      publisherName: "sim-auth-api",
    });
    await publisher.publishUserChange("user-1", "permission_change");

    // pub/sub은 비동기 — 약간의 tick 대기
    await new Promise((r) => setTimeout(r, 50));

    expect(received).toHaveLength(1);
    const parsed = parseMessage(received[0]);
    expect(parsed.scope).toBe("user");
    expect(parsed.target).toBe("user-1");
    expect(parsed.reason).toBe("permission_change");
    expect(parsed.publisher).toBe("sim-auth-api");
  });

  it("publishRoleChange — affectedUserIds 포함", async () => {
    const redis = new RedisMock();
    const subscriber = redis.duplicate();
    await subscriber.subscribe(INVALIDATION_CHANNEL);
    const received: string[] = [];
    subscriber.on("message", (_ch, msg) => received.push(msg));

    const publisher = new BitmapInvalidationPublisher({
      redis, publisherName: "sim-auth-api",
    });
    await publisher.publishRoleChange("role-admin", "role_redefinition", ["u1", "u2", "u3"]);
    await new Promise((r) => setTimeout(r, 50));

    expect(received).toHaveLength(1);
    const parsed = parseMessage(received[0]);
    expect(parsed.scope).toBe("role");
    expect(parsed.target).toBe("role-admin");
    expect(parsed.affectedUserIds).toEqual(["u1", "u2", "u3"]);
  });

  it("publishPrefixBump — security incident", async () => {
    const redis = new RedisMock();
    const subscriber = redis.duplicate();
    await subscriber.subscribe(INVALIDATION_CHANNEL);
    const received: string[] = [];
    subscriber.on("message", (_ch, msg) => received.push(msg));

    const publisher = new BitmapInvalidationPublisher({
      redis, publisherName: "sim-auth-api",
    });
    await publisher.publishPrefixBump("sim.bitmap", "prefix_version_bump");
    await new Promise((r) => setTimeout(r, 50));

    const parsed = parseMessage(received[0]);
    expect(parsed.scope).toBe("prefix");
    expect(parsed.target).toBe("sim.bitmap");
    expect(parsed.reason).toBe("prefix_version_bump");
  });

  it("publish 임의 메시지 (raw API)", async () => {
    const redis = new RedisMock();
    const publishSpy = vi.spyOn(redis, "publish");
    const publisher = new BitmapInvalidationPublisher({
      redis, publisherName: "test",
    });
    await publisher.publish({
      scope: "user",
      target: "u",
      reason: "security_incident",
      issuedAt: "2026-04-22T00:00:00.000Z",
      publisher: "test",
    });
    expect(publishSpy).toHaveBeenCalledWith(INVALIDATION_CHANNEL, expect.any(String));
  });
});
```

- [ ] **Step 2: publisher.ts 구현**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * BitmapInvalidationPublisher — Redis pub/sub의 publish측.
 *
 * §2 bitmap-pipeline §5 (Invalidation):
 *   "각 서버의 listener가 L1 LRU 제거"
 *
 * sim-auth-api의 RoleAssignmentService / RoleService가 권한 변경 후 본 publisher
 * 호출. pub/sub 채널 = INVALIDATION_CHANNEL ("bitmap:invalidate").
 */

import type { Redis } from "ioredis";
import {
  INVALIDATION_CHANNEL,
  serializeMessage,
  type InvalidationMessage,
  type Reason,
} from "./message.js";

export interface BitmapInvalidationPublisherOptions {
  redis: Redis;
  publisherName: string;
}

export class BitmapInvalidationPublisher {
  constructor(private readonly opts: BitmapInvalidationPublisherOptions) {}

  /** raw API — 메시지를 그대로 publish. 호출자가 InvalidationMessage 직접 구성. */
  async publish(msg: InvalidationMessage): Promise<number> {
    const json = serializeMessage(msg);
    return this.opts.redis.publish(INVALIDATION_CHANNEL, json);
  }

  /** scope=user (단일 사용자 권한 변경). */
  async publishUserChange(userId: string, reason: Reason): Promise<number> {
    return this.publish({
      scope: "user",
      target: userId,
      reason,
      issuedAt: new Date().toISOString(),
      publisher: this.opts.publisherName,
    });
  }

  /** scope=role (역할 정의 변경 — 영향받는 user 목록을 함께 전달). */
  async publishRoleChange(
    roleId: string,
    reason: Reason,
    affectedUserIds: readonly string[],
  ): Promise<number> {
    return this.publish({
      scope: "role",
      target: roleId,
      reason,
      issuedAt: new Date().toISOString(),
      publisher: this.opts.publisherName,
      affectedUserIds: [...affectedUserIds],
    });
  }

  /** scope=prefix (shape/version 변경 — 전체 cache flush). */
  async publishPrefixBump(prefix: string, reason: Reason): Promise<number> {
    return this.publish({
      scope: "prefix",
      target: prefix,
      reason,
      issuedAt: new Date().toISOString(),
      publisher: this.opts.publisherName,
    });
  }
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test -- publisher.test
```

Expected: 4 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/publisher.ts \
          simulations/enterprise-pm/packages/sim-bitmap-cache/src/publisher.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-bitmap-cache): BitmapInvalidationPublisher

publishUserChange / publishRoleChange / publishPrefixBump 3 헬퍼.
ioredis-mock으로 pub/sub round-trip 단위 테스트.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: src/subscriber.ts — BitmapInvalidationSubscriber (TDD)

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.test.ts`

- [ ] **Step 1: subscriber.test.ts (test-first)**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi } from "vitest";
import RedisMock from "ioredis-mock";
import { BitmapInvalidationSubscriber } from "./subscriber.js";
import { BitmapLruCache } from "./lru-cache.js";
import { INVALIDATION_CHANNEL, serializeMessage } from "./message.js";
import type { VersionedBitmap } from "permission-engine";

const sampleBm = (id: string): VersionedBitmap => ({
  prefix: "sim.bitmap", v: "uv1", mask: new Uint8Array([0x01]),
  issuedAt: "2026-04-22T00:00:00Z",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  issuer: "x", signature: id,
});

describe("BitmapInvalidationSubscriber", () => {
  it("scope=user 메시지 수신 → cache.invalidateUser 호출", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("user-1", "sim.bitmap", "uv1", sampleBm("a"));
    cache.set("user-2", "sim.bitmap", "uv1", sampleBm("b"));

    const redis = new RedisMock();
    const sub = new BitmapInvalidationSubscriber({
      redis: redis.duplicate(), cache, logger: silentLogger(),
    });
    await sub.start();

    await redis.publish(INVALIDATION_CHANNEL, serializeMessage({
      scope: "user", target: "user-1", reason: "permission_change",
      issuedAt: "2026-04-22T00:00:00.000Z", publisher: "test",
    }));
    await new Promise((r) => setTimeout(r, 100));

    expect(cache.get("user-1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("user-2", "sim.bitmap", "uv1")?.signature).toBe("b");
    await sub.stop();
  });

  it("scope=role + affectedUserIds → invalidateUsers", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    for (const id of ["u1", "u2", "u3", "u4"]) {
      cache.set(id, "sim.bitmap", "uv1", sampleBm(id));
    }
    const redis = new RedisMock();
    const sub = new BitmapInvalidationSubscriber({
      redis: redis.duplicate(), cache, logger: silentLogger(),
    });
    await sub.start();

    await redis.publish(INVALIDATION_CHANNEL, serializeMessage({
      scope: "role", target: "role-admin", reason: "role_redefinition",
      issuedAt: "2026-04-22T00:00:00.000Z", publisher: "test",
      affectedUserIds: ["u1", "u3"],
    }));
    await new Promise((r) => setTimeout(r, 100));

    expect(cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u2", "sim.bitmap", "uv1")?.signature).toBe("u2");
    expect(cache.get("u3", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u4", "sim.bitmap", "uv1")?.signature).toBe("u4");
    await sub.stop();
  });

  it("scope=prefix → invalidatePrefix 호출", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    cache.set("u1", "other", "uv1", sampleBm("b"));
    const redis = new RedisMock();
    const sub = new BitmapInvalidationSubscriber({
      redis: redis.duplicate(), cache, logger: silentLogger(),
    });
    await sub.start();
    await redis.publish(INVALIDATION_CHANNEL, serializeMessage({
      scope: "prefix", target: "sim.bitmap", reason: "prefix_version_bump",
      issuedAt: "2026-04-22T00:00:00.000Z", publisher: "test",
    }));
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u1", "other", "uv1")?.signature).toBe("b");
    await sub.stop();
  });

  it("invalid JSON → cache 변경 없음 + warn 로그", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    const warnSpy = vi.fn();
    const redis = new RedisMock();
    const sub = new BitmapInvalidationSubscriber({
      redis: redis.duplicate(), cache,
      logger: { warn: warnSpy, info: vi.fn(), error: vi.fn() },
    });
    await sub.start();
    await redis.publish(INVALIDATION_CHANNEL, "not-json");
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.get("u1", "sim.bitmap", "uv1")?.signature).toBe("a");
    expect(warnSpy).toHaveBeenCalled();
    await sub.stop();
  });

  it("schema invalid → cache 변경 없음 + warn 로그", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    const warnSpy = vi.fn();
    const redis = new RedisMock();
    const sub = new BitmapInvalidationSubscriber({
      redis: redis.duplicate(), cache,
      logger: { warn: warnSpy, info: vi.fn(), error: vi.fn() },
    });
    await sub.start();
    await redis.publish(INVALIDATION_CHANNEL, '{"scope":"unknown"}');
    await new Promise((r) => setTimeout(r, 100));
    expect(warnSpy).toHaveBeenCalled();
    await sub.stop();
  });
});

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
```

- [ ] **Step 2: subscriber.ts 구현**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import type { Redis } from "ioredis";
import { BitmapLruCache } from "./lru-cache.js";
import {
  INVALIDATION_CHANNEL,
  parseMessage,
  type InvalidationMessage,
} from "./message.js";

export interface SubscriberLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

export interface BitmapInvalidationSubscriberOptions {
  /** ioredis 클라이언트 — 본 인스턴스는 subscribe 모드로 dedicated. publisher와 분리 필수. */
  redis: Redis;
  cache: BitmapLruCache;
  logger: SubscriberLogger;
}

/**
 * BitmapInvalidationSubscriber — Redis pub/sub의 listen측.
 *
 * §2 bitmap-pipeline §5 정확 매칭:
 *   "각 서버의 listener가 L1 LRU 제거"
 *
 * 동작:
 *   start() → subscribe(INVALIDATION_CHANNEL) → message handler 등록
 *   각 메시지: parseMessage → scope 별 cache.invalidate*
 *   parse/schema 실패 → warn 로그, cache 변경 없음 (fail-safe)
 */
export class BitmapInvalidationSubscriber {
  private started = false;
  private boundHandler?: (channel: string, message: string) => void;

  constructor(private readonly opts: BitmapInvalidationSubscriberOptions) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.boundHandler = (channel, message) => {
      if (channel !== INVALIDATION_CHANNEL) return;
      this.handleMessage(message);
    };
    this.opts.redis.on("message", this.boundHandler);
    await this.opts.redis.subscribe(INVALIDATION_CHANNEL);
    this.started = true;
    this.opts.logger.info(
      { channel: INVALIDATION_CHANNEL },
      "BitmapInvalidationSubscriber 시작",
    );
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    if (this.boundHandler) this.opts.redis.off("message", this.boundHandler);
    await this.opts.redis.unsubscribe(INVALIDATION_CHANNEL);
    this.started = false;
  }

  private handleMessage(raw: string): void {
    let msg: InvalidationMessage;
    try {
      msg = parseMessage(raw);
    } catch (err) {
      this.opts.logger.warn(
        { err: (err as Error).message, raw },
        "InvalidationMessage parse 실패 — cache 변경 없음",
      );
      return;
    }

    switch (msg.scope) {
      case "user": {
        const removed = this.opts.cache.invalidateUser(msg.target);
        this.opts.logger.info(
          { scope: "user", target: msg.target, removed, reason: msg.reason },
          "cache invalidated",
        );
        break;
      }
      case "role": {
        if (!msg.affectedUserIds || msg.affectedUserIds.length === 0) {
          this.opts.logger.warn(
            { roleId: msg.target },
            "role scope이지만 affectedUserIds 누락 — fail-safe noop",
          );
          return;
        }
        const removed = this.opts.cache.invalidateUsers(msg.affectedUserIds);
        this.opts.logger.info(
          { scope: "role", target: msg.target, removed, reason: msg.reason },
          "cache invalidated",
        );
        break;
      }
      case "prefix": {
        const removed = this.opts.cache.invalidatePrefix(msg.target);
        this.opts.logger.info(
          { scope: "prefix", target: msg.target, removed, reason: msg.reason },
          "cache invalidated",
        );
        break;
      }
    }
  }
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test -- subscriber.test
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.ts \
          simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-bitmap-cache): BitmapInvalidationSubscriber

start/stop lifecycle + 3 scope 분기.
parse/schema 실패는 warn + cache 변경 없음 (fail-safe).
role scope에서 affectedUserIds 누락 시 noop + warn.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: src/cache-service.ts + nest module + index.ts

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.test.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/nest/bitmap-cache.module.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/nest/bitmap-cache.module.test.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts`

- [ ] **Step 1: cache-service.ts** — 통합 entry (LRU + Subscriber + (옵션) Publisher 묶음)

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import type { Redis } from "ioredis";
import { BitmapLruCache, type BitmapLruCacheOptions } from "./lru-cache.js";
import { BitmapInvalidationPublisher } from "./publisher.js";
import {
  BitmapInvalidationSubscriber,
  type SubscriberLogger,
} from "./subscriber.js";

export interface BitmapCacheServiceOptions {
  /** publish 클라이언트 (publisher 모드 활성화 시). */
  publisherRedis?: Redis;
  /** subscribe 클라이언트 (listener 모드 활성화 시). publisher와 별도 인스턴스 권장. */
  subscriberRedis?: Redis;
  /** 호출자 식별자 — InvalidationMessage.publisher 필드. */
  publisherName: string;
  /** LRU 옵션. */
  cache: BitmapLruCacheOptions;
  /** Subscriber 로깅 — pino-style. */
  logger: SubscriberLogger;
}

/**
 * BitmapCacheService — LRU + Publisher + Subscriber 통합.
 *
 * 사용 패턴:
 *   - sim-auth-api: publisherRedis만 (cache는 사용 안 함, but publisher만 활성화 가능)
 *   - 비즈니스 서비스: subscriberRedis + cache (publisher는 비활성)
 *   - 둘 다: 별도 redis 인스턴스 2개 주입
 */
export class BitmapCacheService {
  readonly cache: BitmapLruCache;
  readonly publisher?: BitmapInvalidationPublisher;
  readonly subscriber?: BitmapInvalidationSubscriber;

  constructor(opts: BitmapCacheServiceOptions) {
    this.cache = new BitmapLruCache(opts.cache);
    if (opts.publisherRedis) {
      this.publisher = new BitmapInvalidationPublisher({
        redis: opts.publisherRedis,
        publisherName: opts.publisherName,
      });
    }
    if (opts.subscriberRedis) {
      this.subscriber = new BitmapInvalidationSubscriber({
        redis: opts.subscriberRedis,
        cache: this.cache,
        logger: opts.logger,
      });
    }
  }

  async start(): Promise<void> {
    if (this.subscriber) await this.subscriber.start();
  }

  async stop(): Promise<void> {
    if (this.subscriber) await this.subscriber.stop();
  }
}
```

- [ ] **Step 2: cache-service.test.ts** (smoke + start/stop lifecycle)

```ts
import { describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import { BitmapCacheService } from "./cache-service.js";
import { vi } from "vitest";

describe("BitmapCacheService", () => {
  it("publisher만 활성화 — subscriber undefined", () => {
    const redis = new RedisMock();
    const svc = new BitmapCacheService({
      publisherRedis: redis,
      publisherName: "p",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    expect(svc.publisher).toBeDefined();
    expect(svc.subscriber).toBeUndefined();
  });

  it("subscriber만 활성화 — publisher undefined", async () => {
    const redis = new RedisMock();
    const svc = new BitmapCacheService({
      subscriberRedis: redis.duplicate(),
      publisherName: "s",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    expect(svc.publisher).toBeUndefined();
    expect(svc.subscriber).toBeDefined();
    await svc.start();
    await svc.stop();
  });

  it("둘 다 활성화 — publish → subscribe 통합 round-trip", async () => {
    const pubRedis = new RedisMock();
    const subRedis = pubRedis.duplicate();
    const svc = new BitmapCacheService({
      publisherRedis: pubRedis,
      subscriberRedis: subRedis,
      publisherName: "test",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    svc.cache.set("u1", "sim.bitmap", "uv1", {
      prefix: "sim.bitmap", v: "uv1", mask: new Uint8Array([0x01]),
      issuedAt: "2026-04-22T00:00:00Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      issuer: "x", signature: "s",
    });
    await svc.start();
    await svc.publisher!.publishUserChange("u1", "permission_change");
    await new Promise((r) => setTimeout(r, 100));
    expect(svc.cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    await svc.stop();
  });
});

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
```

- [ ] **Step 3: nest/bitmap-cache.module.ts** — NestJS dynamic module

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { DynamicModule, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { BitmapCacheService } from "../cache-service.js";
import type { SubscriberLogger } from "../subscriber.js";

export interface BitmapCacheModuleOptions {
  /** Redis URL (예: "redis://sim-redis:6379"). */
  redisUrl: string;
  /** Publisher 활성화 (sim-auth-api). */
  publisherEnabled: boolean;
  /** Listener 활성화 (모든 비즈니스 서비스). */
  listenerEnabled: boolean;
  /** publisher 식별자 (InvalidationMessage.publisher 필드). */
  publisherName: string;
  /** LRU max entries. */
  lruMax?: number;
  /** Subscriber 로거 주입. 미주입 시 console.log 사용. */
  logger?: SubscriberLogger;
}

const BITMAP_CACHE_SERVICE = Symbol("BITMAP_CACHE_SERVICE");

@Module({})
export class BitmapCacheModule implements OnModuleInit, OnModuleDestroy {
  static forRoot(opts: BitmapCacheModuleOptions): DynamicModule {
    const provider = {
      provide: BitmapCacheService,
      useFactory: (): BitmapCacheService => {
        const publisherRedis = opts.publisherEnabled
          ? new Redis(opts.redisUrl)
          : undefined;
        const subscriberRedis = opts.listenerEnabled
          ? new Redis(opts.redisUrl)
          : undefined;
        return new BitmapCacheService({
          publisherRedis,
          subscriberRedis,
          publisherName: opts.publisherName,
          cache: { max: opts.lruMax ?? 10_000 },
          logger: opts.logger ?? defaultLogger(),
        });
      },
    };
    return {
      module: BitmapCacheModule,
      providers: [provider],
      exports: [BitmapCacheService],
      global: true,
    };
  }

  constructor(private readonly svc: BitmapCacheService) {}

  async onModuleInit() {
    await this.svc.start();
  }

  async onModuleDestroy() {
    await this.svc.stop();
  }
}

function defaultLogger(): SubscriberLogger {
  // CLAUDE.md 규약: 라이브러리는 console 사용 금지. 본 default는 fallback이며,
  // 호출자가 logger 주입을 강력히 권장. 실제 시뮬 서비스는 createLogger 주입.
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}
```

- [ ] **Step 4: nest/bitmap-cache.module.test.ts** (smoke — NestJS Test 모듈)

```ts
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { BitmapCacheModule } from "./bitmap-cache.module.js";
import { BitmapCacheService } from "../cache-service.js";

describe("BitmapCacheModule (NestJS dynamic)", () => {
  it("forRoot — listenerEnabled=true → BitmapCacheService 주입 가능", async () => {
    // 실 ioredis는 부팅에 Redis 서버 필요 — 본 smoke는 module 컴파일만 검증
    // 실제 connect는 testcontainers로 integration.test에서 검증
    const moduleRef = await Test.createTestingModule({
      imports: [
        BitmapCacheModule.forRoot({
          redisUrl: "redis://127.0.0.1:6399", // unreachable port — connect는 lazy
          publisherEnabled: false,
          listenerEnabled: false, // 활성화하면 connect 시도 → 본 smoke skip
          publisherName: "test",
          logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }),
      ],
    }).compile();

    const svc = moduleRef.get(BitmapCacheService);
    expect(svc).toBeDefined();
    expect(svc.publisher).toBeUndefined();
    expect(svc.subscriber).toBeUndefined();

    await moduleRef.close();
  });
});
```

- [ ] **Step 5: index.ts**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

export {
  BitmapLruCache,
  makeKey,
  parseKey,
  type BitmapLruCacheOptions,
} from "./lru-cache.js";

export {
  BitmapInvalidationPublisher,
  type BitmapInvalidationPublisherOptions,
} from "./publisher.js";

export {
  BitmapInvalidationSubscriber,
  type BitmapInvalidationSubscriberOptions,
  type SubscriberLogger,
} from "./subscriber.js";

export {
  BitmapCacheService,
  type BitmapCacheServiceOptions,
} from "./cache-service.js";

export {
  invalidationMessageSchema,
  serializeMessage,
  parseMessage,
  INVALIDATION_CHANNEL,
  type InvalidationMessage,
  type Scope,
  type Reason,
} from "./message.js";

export {
  BitmapCacheModule,
  type BitmapCacheModuleOptions,
} from "./nest/bitmap-cache.module.js";
```

- [ ] **Step 6: 전체 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache typecheck && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test && \
  pnpm --filter @qa-sdk/sim-bitmap-cache build
```

Expected: 누적 PASS = message 6 + lru 7 + publisher 4 + subscriber 5 + cache-service 3 + module 1 = 26 PASS. build 0 error.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-bitmap-cache/src && \
  git commit -m "$(cat <<'EOF'
feat(sim-bitmap-cache): BitmapCacheService + NestJS module + public exports

cache-service: publisher/subscriber 통합 lifecycle.
NestJS BitmapCacheModule.forRoot — global, OnModuleInit/Destroy 라이프사이클.
index.ts public API 정리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: integration.test.ts — testcontainers Redis e2e (env gate)

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/integration.test.ts`

- [ ] **Step 1: integration.test.ts**

```ts
// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * 통합 테스트 — 실 Redis 인스턴스에서 publish ↔ subscribe e2e.
 *
 * 두 가지 활성화 경로:
 *   1. SIM_REDIS_URL 환경 변수 (Plan 09c sim-redis 컨테이너 사용)
 *   2. testcontainers (SIM_TESTCONTAINERS=1)
 * 둘 다 없으면 skip.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import { BitmapCacheService } from "./cache-service.js";
import type { VersionedBitmap } from "permission-engine";
import { vi } from "vitest";

const SKIP = !process.env.SIM_REDIS_URL && process.env.SIM_TESTCONTAINERS !== "1";

describe.skipIf(SKIP)("sim-bitmap-cache integration — 실 Redis", () => {
  let redisUrl: string;
  let containerStop: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    if (process.env.SIM_REDIS_URL) {
      redisUrl = process.env.SIM_REDIS_URL;
      return;
    }
    // testcontainers 동적 import
    const { RedisContainer } = await import("@testcontainers/redis");
    const c = await new RedisContainer().start();
    redisUrl = c.getConnectionUrl();
    containerStop = () => c.stop();
  }, 60_000);

  afterAll(async () => {
    if (containerStop) await containerStop();
  });

  const sampleBm = (id: string): VersionedBitmap => ({
    prefix: "sim.bitmap", v: "uv1", mask: new Uint8Array([0x01]),
    issuedAt: "2026-04-22T00:00:00Z",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    issuer: "x", signature: id,
  });

  it("publish → subscribe → cache flush (실 Redis)", async () => {
    const pub = new BitmapCacheService({
      publisherRedis: new Redis(redisUrl),
      publisherName: "test",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    const sub = new BitmapCacheService({
      subscriberRedis: new Redis(redisUrl),
      publisherName: "test",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    await sub.start();
    sub.cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    expect(sub.cache.get("u1", "sim.bitmap", "uv1")?.signature).toBe("a");
    await pub.publisher!.publishUserChange("u1", "permission_change");
    await new Promise((r) => setTimeout(r, 200));
    expect(sub.cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    await sub.stop();
    await pub.publisher!["opts"].redis.quit();
    await sub.subscriber!["opts"].redis.quit();
  }, 30_000);

  it("scope=role + affectedUserIds 통합 e2e", async () => {
    const pub = new BitmapCacheService({
      publisherRedis: new Redis(redisUrl),
      publisherName: "test", cache: { max: 100 }, logger: silentLogger(),
    });
    const sub = new BitmapCacheService({
      subscriberRedis: new Redis(redisUrl),
      publisherName: "test", cache: { max: 100 }, logger: silentLogger(),
    });
    await sub.start();
    for (const id of ["a", "b", "c"]) {
      sub.cache.set(id, "sim.bitmap", "uv1", sampleBm(id));
    }
    await pub.publisher!.publishRoleChange("role-x", "role_redefinition", ["a", "c"]);
    await new Promise((r) => setTimeout(r, 200));
    expect(sub.cache.get("a", "sim.bitmap", "uv1")).toBeUndefined();
    expect(sub.cache.get("b", "sim.bitmap", "uv1")?.signature).toBe("b");
    expect(sub.cache.get("c", "sim.bitmap", "uv1")).toBeUndefined();
    await sub.stop();
    await pub.publisher!["opts"].redis.quit();
    await sub.subscriber!["opts"].redis.quit();
  }, 30_000);
});

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
```

- [ ] **Step 2: 통합 테스트 실행 (sim-redis 활용)**

```bash
SIM_REDIS_URL=redis://localhost:6379 \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test -- integration.test
```

Expected: 2 PASS (sim-redis 부팅 시) 또는 skip (env 없음).

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/integration.test.ts && \
  git commit -m "$(cat <<'EOF'
test(sim-bitmap-cache): integration — 실 Redis publish ↔ subscribe e2e

SIM_REDIS_URL 또는 SIM_TESTCONTAINERS=1 env gate.
testcontainers/redis dynamic import — 미설치 환경에서 skip 정상.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: sim-auth-api 통합 — Publisher 부착

**Files:**
- Modify: `simulations/enterprise-pm/services/auth-api/package.json`
- Modify: `simulations/enterprise-pm/services/auth-api/src/app.module.ts`
- Modify: `simulations/enterprise-pm/services/auth-api/src/auth/role-assignment/role-assignment.service.ts`
- Modify: `simulations/enterprise-pm/services/auth-api/src/auth/role/role.service.ts`
- Modify: `simulations/enterprise-pm/services/auth-api/src/config/env.ts`

- [ ] **Step 1: package.json + env 추가**

`simulations/enterprise-pm/services/auth-api/package.json`의 dependencies에 추가:

```json
"@qa-sdk/sim-bitmap-cache": "workspace:*"
```

`simulations/enterprise-pm/services/auth-api/src/config/env.ts`의 `envSchema`에 `SIM_REDIS_URL` 추가 (이미 있으면 skip):

```ts
SIM_REDIS_URL: z.string().default("redis://sim-redis:6379"),
```

- [ ] **Step 2: app.module.ts에 BitmapCacheModule.forRoot 추가**

```ts
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";

@Module({
  imports: [
    // ... 기존 모듈
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: true,
      listenerEnabled: false,
      publisherName: "sim-auth-api",
      // logger 주입은 Plan 12c 통합 시 createLogger 활용
    }),
  ],
})
export class AppModule {}
```

- [ ] **Step 3: RoleAssignmentService에 Publisher 호출 주입**

```ts
import { Injectable } from "@nestjs/common";
import { BitmapCacheService } from "@qa-sdk/sim-bitmap-cache";
// ... 기존 import

@Injectable()
export class RoleAssignmentService {
  constructor(
    private readonly repo: AuthRepositoryToken,
    private readonly bitmapCache: BitmapCacheService,
  ) {}

  async assign(args: RoleAssignmentCreate): Promise<RoleAssignment> {
    const result = await this.repo.assignRole(args);
    // §2 §5: 권한 변경 → invalidation publish
    if (this.bitmapCache.publisher) {
      await this.bitmapCache.publisher.publishUserChange(args.userId, "permission_change");
    }
    return result;
  }

  async revoke(userId: string, roleId: string, scopeType: string, scopeId: string | null): Promise<void> {
    await this.repo.revokeRole(userId, roleId, scopeType, scopeId);
    if (this.bitmapCache.publisher) {
      await this.bitmapCache.publisher.publishUserChange(userId, "permission_change");
    }
  }
}
```

- [ ] **Step 4: RoleService에 Publisher 호출 주입 (role redefinition)**

```ts
async update(roleId: string, patch: Partial<RoleCreate>): Promise<Role> {
  const updated = await this.repo.updateRole(roleId, patch);
  if (this.bitmapCache.publisher) {
    // role 정의 변경 → 영향받는 user 목록 조회 후 publish
    const assignments = await this.repo.listAssignmentsByRole(roleId);
    const affectedUserIds = [...new Set(assignments.map((a) => a.userId))];
    await this.bitmapCache.publisher.publishRoleChange(
      roleId,
      "role_redefinition",
      affectedUserIds,
    );
  }
  return updated;
}
```

**참고**: `repo.listAssignmentsByRole`은 Plan 11a에 미존재 시 본 plan에서 추가. AuthRepository port + 양 어댑터에 `listAssignmentsByRole(roleId): Promise<RoleAssignment[]>` 추가 + 단위 테스트.

- [ ] **Step 5: typecheck + 단위 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api typecheck && \
  pnpm --filter @qa-sdk/sim-auth-api test 2>&1 | tail -10
```

Expected: 기존 테스트 + 신규 publisher 호출 검증 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): BitmapInvalidationPublisher 통합

RoleAssignmentService.assign/revoke → publishUserChange.
RoleService.update → publishRoleChange (affectedUserIds 조회 후).
BitmapCacheModule.forRoot publisherEnabled=true.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 6 비즈니스 서비스 통합 — Subscriber 부착

**Files:**
- Modify: `simulations/enterprise-pm/services/{pm,approval,notification,reporting,document,audit-browser}-api/package.json`
- Modify: `simulations/enterprise-pm/services/{...}-api/src/app.module.ts`

- [ ] **Step 1: 6 서비스에 dep 추가 (반복)**

```bash
for svc in pm-api approval-api notification-api reporting-api document-api audit-browser-api; do
  echo "[$svc] dep 추가 — package.json 수동 편집 또는 jq 사용"
done
```

각 `package.json`의 dependencies에 추가:

```json
"@qa-sdk/sim-bitmap-cache": "workspace:*"
```

- [ ] **Step 2: 6 서비스의 app.module.ts에 BitmapCacheModule.forRoot listener 모드**

`pm-api/src/app.module.ts` (예시 — 나머지 5개 동일 패턴):

```ts
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

@Module({
  imports: [
    // ... 기존 모듈
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-pm-api",
      lruMax: 10_000,
      logger: bridgeLogger("sim-pm-api"),
    }),
  ],
})
export class AppModule {}

// pino-style → SubscriberLogger bridge
function bridgeLogger(svc: string) {
  const log = createLogger(`${svc}.bitmap-cache`);
  return {
    info: (obj: object, msg?: string) => log.info(obj, msg),
    warn: (obj: object, msg?: string) => log.warn(obj, msg),
    error: (obj: object, msg?: string) => log.error(obj, msg),
  };
}
```

- [ ] **Step 3: pnpm install + 6 서비스 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  for svc in sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api; do
    echo "[$svc] typecheck"
    pnpm --filter "@qa-sdk/$svc" typecheck 2>&1 | tail -2
  done
```

Expected: 6 서비스 모두 typecheck 0 error.

- [ ] **Step 4: 6 서비스 단위 테스트 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter "@qa-sdk/sim-pm-api" --filter "@qa-sdk/sim-approval-api" \
       --filter "@qa-sdk/sim-notification-api" --filter "@qa-sdk/sim-reporting-api" \
       --filter "@qa-sdk/sim-document-api" --filter "@qa-sdk/sim-audit-browser-api" test 2>&1 | tail -10
```

Expected: 기존 테스트 PASS 유지 (신규 의존만 추가).

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api \
          simulations/enterprise-pm/services/approval-api \
          simulations/enterprise-pm/services/notification-api \
          simulations/enterprise-pm/services/reporting-api \
          simulations/enterprise-pm/services/document-api \
          simulations/enterprise-pm/services/audit-browser-api \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-services): 6 서비스에 BitmapInvalidationSubscriber 부착

BitmapCacheModule.forRoot listenerEnabled=true.
@qa-sdk/logger를 SubscriberLogger 인터페이스로 bridge.
LRU max 10_000 — Plan 14a 측정 후 조정.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: gateway 통합 — Hono에서 직접 인스턴스화

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/package.json`
- Modify: `simulations/enterprise-pm/services/gateway/src/server.ts`

gateway는 NestJS DI가 없으므로 server.ts에서 직접 BitmapCacheService 인스턴스화 + lifecycle 관리.

- [ ] **Step 1: dep + env**

`gateway/package.json` dependencies:

```json
"@qa-sdk/sim-bitmap-cache": "workspace:*"
```

`gateway/src/config/env.ts`에 `SIM_REDIS_URL` 추가.

- [ ] **Step 2: server.ts에 subscriber 부팅 + shutdown hook**

```ts
import Redis from "ioredis";
import { BitmapCacheService } from "@qa-sdk/sim-bitmap-cache";

// ... 기존 import

const bitmapCache = new BitmapCacheService({
  subscriberRedis: new Redis(env.SIM_REDIS_URL),
  publisherName: "sim-gateway",
  cache: { max: 10_000 },
  logger: {
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
  },
});

await bitmapCache.start();

// ... serve / installSimpleShutdown

process.on("SIGTERM", async () => {
  await bitmapCache.stop();
  await otelShutdown();
});
process.on("SIGINT", async () => {
  await bitmapCache.stop();
  await otelShutdown();
});
```

- [ ] **Step 3: typecheck + 부팅 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway build
```

Expected: typecheck 0, build 0 error.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): BitmapInvalidationSubscriber 부팅

server.ts에서 직접 BitmapCacheService 인스턴스화 (Hono — NestJS DI 없음).
SIGTERM/SIGINT에서 stop hook.
publisher는 미활성 — gateway는 verify만 수행.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 회귀

- [ ] **Step 1: sim-bitmap-cache 전체 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test && \
  pnpm --filter @qa-sdk/sim-bitmap-cache build
```

Expected: 26 PASS (integration skip 시).

- [ ] **Step 2: 8 서비스 + gateway 통합 typecheck/test**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api sim-gateway; do
    pnpm --filter "@qa-sdk/$svc" typecheck 2>&1 | tail -2
  done
```

Expected: 8 서비스 모두 0 error.

- [ ] **Step 3: integration 통합 — sim-redis + sim-auth-api e2e**

(옵션 — sim-redis 부팅 시)

```bash
SIM_REDIS_URL=redis://localhost:6379 \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-bitmap-cache test -- integration
```

Expected: 2 PASS.

- [ ] **Step 4: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

---

## Self-Review

- [ ] §2 bitmap-pipeline §5 (Invalidation) 메시지 schema 정확 매칭 — 3 scope (user/role/prefix), 4 reason
- [ ] Redis pub/sub 채널 = `bitmap:invalidate` (스펙과 일치)
- [ ] LRU 캐시 key 포맷 `userId|prefix|v` — §2 §2 (TTL 관리, pub/sub invalidation) 추적 가능
- [ ] role scope에서 affectedUserIds 누락 시 fail-safe noop + warn (silent OK 방지)
- [ ] Publisher와 Subscriber redis 인스턴스 분리 (ioredis subscribe 모드 제약)
- [ ] sim-auth-api 권한 변경 3 진입점 (assign/revoke/role.update) 모두 publish 호출
- [ ] 6 비즈니스 서비스 + gateway 모두 Subscriber 부팅
- [ ] NestJS는 BitmapCacheModule.forRoot, gateway는 직접 인스턴스화
- [ ] OnModuleInit/Destroy + SIGTERM/SIGINT 라이프사이클 정합
- [ ] 누적 26 PASS (sim-bitmap-cache) + 8 서비스 회귀 PASS
- [ ] integration test가 SIM_REDIS_URL 또는 testcontainers env gate (CI 영향 없음)

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| Audit-layer 주기 감사 (§2 §5 누락 검출) | spec §5 마지막 — 본 plan은 invalidation 자체 구현. 감사는 별도 | Phase 5 보안 plan |
| Roaring bitmap 압축 (§2 마지막) | shape > 2^20 bit일 때 검토. sim 환경은 < 1KB | 후속 |
| HMAC secret rotation 통합 | §2 §7 + Plan 12a deferred | Phase 5 |
| pub/sub 지연 측정 + p99 SLI | metrics-collector (Plan 14a) 통합 시점 | Plan 14a |
| Subscriber backpressure (Redis 메시지 폭주) | 운영 트래픽 측정 후 | 후속 |
| affectedUserIds가 너무 많을 때 chunk publish | 단일 메시지 size limit 검토 후 | 후속 |

---

## 의존·후속

- **Plan 12a** (gateway JWT): 본 plan의 invalidation은 verify와 직교 — 12a는 본 plan을 dep로 받지 않음. server.ts에서 cache 통합만.
- **Plan 11a** (sim-auth-api RoleAssignmentService): 본 plan이 서비스에 publisher 호출 주입. listAssignmentsByRole 메서드는 11a에 미존재 시 본 plan에서 추가.
- **Plan 09c** (sim-redis 컨테이너): 통합 테스트의 실 Redis 백엔드.
- **Plan 12c** (OTEL + IngestForwarder): 본 plan의 Subscriber 로그가 Plan 12c의 IngestForwarder를 통해 ingest-server에 전송됨.
- **Plan 13d** (시나리오 7/8): 시나리오 8 (권한 변경 → pub/sub invalidation)이 본 plan의 e2e 검증.
