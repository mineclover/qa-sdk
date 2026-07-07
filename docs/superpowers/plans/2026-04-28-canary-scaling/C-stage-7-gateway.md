---
status: source-backed
sources:
  - simulations/enterprise-pm/services/gateway/src/routing/routing-table.ts
  - simulations/enterprise-pm/services/gateway/src/routing/routing-table.test.ts
  - simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.ts
  - simulations/enterprise-pm/services/gateway/src/routing/route-decision.ts
  - simulations/enterprise-pm/services/gateway/src/routes/admin-routing.ts
  - simulations/enterprise-pm/services/gateway/src/routes/admin-routing.test.ts
  - simulations/enterprise-pm/services/gateway/src/routing/integration.test.ts
---

## 단계 7: gateway 변경 — routing table + sticky + version stamp + escape hatch

**Spec 참조:** `02-canary-topology.md` §3 (§3.1 ~ §3.4)

이 단계는 gateway에 **단일 라우팅 책임**을 부여한다. controller가 push한 routing table(메모리)을 바탕으로 sticky-by-user hashing → upstream 선택 → `x-service-version` stamp → proxy로 이어지는 결정 흐름을 구현하고, `x-canary-override` escape hatch는 내부 IP에서 온 요청에 한해 신뢰한다. 외부 KV/DB 의존을 추가하지 않으며, controller 통신은 `POST /admin/routing` 한 endpoint로 단일화한다.

### File Structure (단계 7)

| 종류 | 경로 |
|---|---|
| Create | `simulations/enterprise-pm/services/gateway/src/routing/routing-table.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routing/routing-table.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routing/route-decision.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routing/route-decision.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/middleware/canary-override.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/middleware/canary-override.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/lib/internal-network.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/lib/internal-network.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routes/admin-routing.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routes/admin-routing.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/lib/routing-bootstrap.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/lib/routing-bootstrap.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routing/integration.test.ts` |
| Modify | `simulations/enterprise-pm/services/gateway/src/lib/proxy.ts` (`x-service-version` injection) |
| Modify | `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts` (route decision 호출 + override 처리) |
| Modify | `simulations/enterprise-pm/services/gateway/src/app.ts` (admin route + override middleware 부착) |
| Modify | `simulations/enterprise-pm/services/gateway/src/server.ts` (routing store 인스턴스화 + bootstrap sync) |
| Modify | `simulations/enterprise-pm/services/gateway/src/config/env.ts` (`CONTROLLER_URL`, `INTERNAL_CIDRS`, `CANARY_TARGETS_JSON` 추가) |
| Modify | `simulations/enterprise-pm/services/gateway/src/integration.test.ts` (1~8 시나리오 무회귀) |

### Task 7.1: RoutingTable 인터페이스 + 메모리 store

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/routing/routing-table.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routing/routing-table.test.ts`

spec `02-canary-topology.md` §3.2 그대로:

```ts
interface RoutingTable {
  routes: {
    [serviceName: string]: {
      revision: number;            // controller가 보낸 결정 revision
      stable:    { version: string; upstream: string };
      candidate: { version: string; upstream: string } | null;
      weight: number;              // 0~100, candidate에 보내는 비율
      stickyKey: "user_id";        // sticky 기준
    };
  };
}
```

> revision 단조증가는 controller가 보장한다. gateway는 들어온 revision이 작거나 같으면 silent drop 한다 (race 방지).

본 task는 위 구조를 in-memory store(`InMemoryRoutingStore`)로 구현하고, revision-based staleness check + 서비스별 조회 + 전체 dump 인터페이스를 노출한다. 외부 KV/DB 의존은 추가하지 않는다 (spec §3.2).

- [ ] **Step 7.1.1: 실패 테스트 작성**

`simulations/enterprise-pm/services/gateway/src/routing/routing-table.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { InMemoryRoutingStore, RouteEntrySchema, type RouteEntry } from "./routing-table.js";

const base: RouteEntry = {
  revision: 1,
  stable: { version: "v3", upstream: "http://sim-approval-api-v1:4500" },
  candidate: null, weight: 0, stickyKey: "user_id",
};

describe("InMemoryRoutingStore", () => {
  it("getRoute undefined when unknown; first upsert always applies", () => {
    const s = new InMemoryRoutingStore();
    expect(s.getRoute("x")).toBeUndefined();
    expect(s.upsertRoute("x", { ...base, revision: 17 }).applied).toBe(true);
    expect(s.getRoute("x")?.revision).toBe(17);
  });

  it("revision staleness: greater overwrites; equal/smaller silent-drop", () => {
    const s = new InMemoryRoutingStore();
    s.upsertRoute("x", { ...base, revision: 5 });
    expect(s.upsertRoute("x", { ...base, revision: 6, weight: 10 }).applied).toBe(true);
    expect(s.upsertRoute("x", { ...base, revision: 6, weight: 99 }).applied).toBe(false);
    expect(s.upsertRoute("x", { ...base, revision: 5, weight: 99 }).applied).toBe(false);
    expect(s.getRoute("x")?.weight).toBe(10);
  });

  it("dump snapshot is isolated (mutation does not leak)", () => {
    const s = new InMemoryRoutingStore();
    s.upsertRoute("x", base);
    const snap = s.dump();
    snap.routes["x"]!.weight = 100;
    expect(s.getRoute("x")?.weight).toBe(0);
  });

  it("RouteEntrySchema rejects weight out of [0,100] and non-user_id stickyKey", () => {
    expect(() => RouteEntrySchema.parse({ ...base, weight: 101 })).toThrow();
    expect(() => RouteEntrySchema.parse({ ...base, weight: -1 })).toThrow();
    expect(() => RouteEntrySchema.parse({ ...base, stickyKey: "session_id" as never })).toThrow();
  });
});
```

- [ ] **Step 7.1.2: 테스트 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter @sim/gateway test routing/routing-table
```

기대: FAIL (모듈 미정의).

- [ ] **Step 7.1.3: 최소 구현**

`simulations/enterprise-pm/services/gateway/src/routing/routing-table.ts`:

```typescript
// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.2 RoutingTable in-memory store.

import { z } from "zod";

const UpstreamPairSchema = z.object({
  version: z.string().regex(/^v[1-9][0-9]*(-candidate|-retired)?$/),
  upstream: z.string().url(),
});

export const RouteEntrySchema = z.object({
  revision: z.number().int().nonnegative(),
  stable: UpstreamPairSchema,
  candidate: UpstreamPairSchema.nullable(),
  weight: z.number().int().min(0).max(100),
  stickyKey: z.literal("user_id"),
});

export type RouteEntry = z.infer<typeof RouteEntrySchema>;
export interface RoutingTable { routes: Record<string, RouteEntry>; }
export interface UpsertResult { applied: boolean; reason?: "stale-revision"; }

export class InMemoryRoutingStore {
  private readonly routes = new Map<string, RouteEntry>();

  upsertRoute(serviceName: string, entry: RouteEntry): UpsertResult {
    const validated = RouteEntrySchema.parse(entry);
    const existing = this.routes.get(serviceName);
    if (existing && validated.revision <= existing.revision) {
      return { applied: false, reason: "stale-revision" };
    }
    this.routes.set(serviceName, validated);
    return { applied: true };
  }

  getRoute(serviceName: string): RouteEntry | undefined {
    return this.routes.get(serviceName);
  }

  dump(): RoutingTable {
    const snapshot: Record<string, RouteEntry> = {};
    for (const [k, v] of this.routes) {
      snapshot[k] = { ...v, stable: { ...v.stable }, candidate: v.candidate ? { ...v.candidate } : null };
    }
    return { routes: snapshot };
  }
}
```

- [ ] **Step 7.1.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test routing/routing-table
git add simulations/enterprise-pm/services/gateway/src/routing/routing-table.ts \
        simulations/enterprise-pm/services/gateway/src/routing/routing-table.test.ts
git commit -m "feat(sim-gateway): RoutingTable Zod schema + InMemoryRoutingStore (revision staleness)"
```

기대: 5 PASS.

### Task 7.2: sticky-by-user 라우팅 결정 함수

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.test.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routing/route-decision.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routing/route-decision.test.ts`

spec §3.1: `stickyHash = hash(user_id) % 100`, `if stickyHash < weight → upstream = candidate else → stable`. spec §3.3 일관성 조건:

- JWT 미포함 요청 (login 등)은 기본 stable로 라우팅한다.
- 롤백 시에는 stickyHash와 무관하게 v1로 강제한다 (`weight=0`).
- weight가 변하더라도 같은 user_id의 라우팅 결정은 hash 함수가 deterministic 하므로 (weight 변동 폭 안에 들지 않는 한) 그대로 유지된다.

hash는 외부 의존 없는 32-bit FNV-1a 고정 (controller/gateway 양쪽이 같은 알고리즘이어야 sticky 일관성 유지).

- [ ] **Step 7.2.1: sticky-hash 테스트 + 구현**

`sticky-hash.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { stickyHashBucket } from "./sticky-hash.js";

describe("stickyHashBucket (FNV-1a 32-bit, mod 100)", () => {
  it("returns integer in [0,99]; deterministic; rejects empty", () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 64 }), (uid) => {
      const b = stickyHashBucket(uid);
      return Number.isInteger(b) && b >= 0 && b < 100;
    }), { numRuns: 500 });
    expect(stickyHashBucket("user-42")).toBe(stickyHashBucket("user-42"));
    expect(() => stickyHashBucket("")).toThrow();
  });

  it("smoke distribution: 1000 inputs hit > 50 buckets", () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 1000; i++) buckets.add(stickyHashBucket(`u-${i}`));
    expect(buckets.size).toBeGreaterThan(50);
  });
});
```

`sticky-hash.ts`:

```typescript
// @def.boundary sim-gateway
// FNV-1a 32-bit. controller/gateway 모두 동일 알고리즘이어야 sticky 일관성 유지.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function stickyHashBucket(userId: string): number {
  if (!userId || userId.length === 0) {
    throw new Error("stickyHashBucket: userId is empty");
  }
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % 100;
}
```

- [ ] **Step 7.2.2: route-decision 테스트**

`route-decision.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { decideRoute, type RouteEntry } from "./route-decision.js";

const stableOnly: RouteEntry = {
  revision: 1,
  stable: { version: "v3", upstream: "http://sim-approval-api-v1:4500" },
  candidate: null, weight: 0, stickyKey: "user_id",
};
const wc: RouteEntry = {
  ...stableOnly, revision: 2,
  candidate: { version: "v4-candidate", upstream: "http://sim-approval-api-v2:4500" },
  weight: 10,
};

describe("decideRoute (spec §3.1/§3.3)", () => {
  it("no candidate / anonymous / weight=0 → stable (no-candidate, anonymous, rollback)", () => {
    expect(decideRoute({ entry: stableOnly, userId: "u" }).reason).toBe("no-candidate");
    expect(decideRoute({ entry: wc, userId: undefined }).reason).toBe("anonymous");
    expect(decideRoute({ entry: { ...wc, weight: 0 }, userId: "u" }).reason).toBe("rollback");
  });

  it("weight=100 → candidate for any userId", () => {
    expect(decideRoute({ entry: { ...wc, weight: 100 }, userId: "x" }).target).toBe("candidate");
  });

  it("weight=50 → ~50% candidate over 1000 users", () => {
    const half: RouteEntry = { ...wc, weight: 50 };
    let cand = 0;
    for (let i = 0; i < 1000; i++) {
      if (decideRoute({ entry: half, userId: `u-${i}` }).target === "candidate") cand++;
    }
    expect(cand).toBeGreaterThan(400);
    expect(cand).toBeLessThan(600);
  });
});
```

- [ ] **Step 7.2.3: route-decision 구현**

`route-decision.ts`:

```typescript
// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.1 라우팅 결정 — 순수 함수, 외부 의존 없음.

import { stickyHashBucket } from "./sticky-hash.js";
import type { RouteEntry } from "./routing-table.js";
export type { RouteEntry };

export interface RouteDecision {
  target: "stable" | "candidate";
  version: string;
  upstream: string;
  reason: "anonymous" | "no-candidate" | "rollback" | "sticky" | "full-canary";
  bucket?: number;
}

export interface DecideRouteArgs { entry: RouteEntry; userId: string | undefined; }

export function decideRoute({ entry, userId }: DecideRouteArgs): RouteDecision {
  const stable = { version: entry.stable.version, upstream: entry.stable.upstream };
  if (entry.candidate === null) return { target: "stable", ...stable, reason: "no-candidate" };
  if (!userId) return { target: "stable", ...stable, reason: "anonymous" };
  if (entry.weight === 0) return { target: "stable", ...stable, reason: "rollback" };
  const cand = { version: entry.candidate.version, upstream: entry.candidate.upstream };
  if (entry.weight >= 100) return { target: "candidate", ...cand, reason: "full-canary" };
  const bucket = stickyHashBucket(userId);
  if (bucket < entry.weight) return { target: "candidate", ...cand, reason: "sticky", bucket };
  return { target: "stable", ...stable, reason: "sticky", bucket };
}
```

- [ ] **Step 7.2.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test routing/sticky-hash routing/route-decision
git add simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.ts \
        simulations/enterprise-pm/services/gateway/src/routing/sticky-hash.test.ts \
        simulations/enterprise-pm/services/gateway/src/routing/route-decision.ts \
        simulations/enterprise-pm/services/gateway/src/routing/route-decision.test.ts
git commit -m "feat(sim-gateway): sticky-by-user FNV-1a + decideRoute (spec §3.1/§3.3)"
```

기대: 4 + 5 = 9 PASS.

### Task 7.3: `x-canary-override` escape hatch + 내부 IP 검증

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/lib/internal-network.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/lib/internal-network.test.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/middleware/canary-override.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/middleware/canary-override.test.ts`

spec §3.4 요건:

> 요청 IP가 시뮬 내부 네트워크에서 온 경우에만 신뢰한다.
> 외부 요청에 들어온 `x-canary-override`는 silent ignore 한다 (에러 응답 X — 외부 공격자에게 정보 노출 X).
> 내부 IP CIDR은 환경변수가 아니라 compose network 정의에서 도출한다.

본 task는 두 부분으로 나뉜다.

1. `internal-network.ts` — IPv4 CIDR 매칭 순수 함수. compose network에서 도출한 CIDR 리스트를 부팅 시 env(`INTERNAL_CIDRS`)로 주입하지만, *값 출처*가 compose network임은 spec §3.4를 따른다 (env는 단순 전달 채널). 외부 라이브러리 없이 자체 IPv4 long-arithmetic.
2. `canary-override.ts` — Hono middleware. 내부 IP에서 온 `x-canary-override` 헤더만 신뢰하여 `c.set("canary-override", { target, version })`로 downstream에 전달. 외부 IP에서 온 헤더는 silent strip.

- [ ] **Step 7.3.1: internal-network 테스트 + 구현**

`internal-network.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isInternalIp, parseCidrList } from "./internal-network.js";

describe("internal-network IPv4 CIDR matcher", () => {
  it("172.16.0.0/12 covers compose default bridge range", () => {
    const cidrs = parseCidrList("172.16.0.0/12");
    expect(isInternalIp("172.17.0.5", cidrs)).toBe(true);
    expect(isInternalIp("172.31.255.255", cidrs)).toBe(true);
    expect(isInternalIp("172.32.0.1", cidrs)).toBe(false);
    expect(isInternalIp("8.8.8.8", cidrs)).toBe(false);
  });

  it("supports comma-separated multi-CIDR", () => {
    const cidrs = parseCidrList("172.16.0.0/12,10.0.0.0/8,127.0.0.0/8");
    expect(isInternalIp("10.5.5.5", cidrs)).toBe(true);
    expect(isInternalIp("127.0.0.1", cidrs)).toBe(true);
    expect(isInternalIp("192.168.1.1", cidrs)).toBe(false);
  });

  it("rejects malformed IP / CIDR", () => {
    const cidrs = parseCidrList("172.16.0.0/12");
    expect(isInternalIp("not-an-ip", cidrs)).toBe(false);
    expect(isInternalIp("999.999.999.999", cidrs)).toBe(false);
    expect(() => parseCidrList("172.16.0.0/33")).toThrow();
    expect(() => parseCidrList("not-a-cidr")).toThrow();
  });

  it("empty CIDR list → no IP is internal", () => {
    expect(parseCidrList("")).toHaveLength(0);
    expect(isInternalIp("172.17.0.5", parseCidrList(""))).toBe(false);
  });
});
```

`internal-network.ts`:

```typescript
// @def.boundary sim-gateway
// spec 02 §3.4 — internal IP only escape hatch.
// 값 출처는 docker compose network 정의이며, INTERNAL_CIDRS env는 단순 전달 채널.

export interface Cidr { base: number; mask: number; prefixLen: number; }

function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let v = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    v = (v * 256 + n) >>> 0;
  }
  return v >>> 0;
}

export function parseCidrList(input: string): Cidr[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const out: Cidr[] = [];
  for (const item of trimmed.split(",")) {
    const cidr = item.trim();
    const m = cidr.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (!m) throw new Error(`invalid CIDR: ${cidr}`);
    const baseInt = ipToInt(m[1]);
    if (baseInt === null) throw new Error(`invalid CIDR base: ${cidr}`);
    const prefixLen = Number(m[2]);
    if (prefixLen < 0 || prefixLen > 32) throw new Error(`invalid CIDR prefix: ${cidr}`);
    const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
    out.push({ base: (baseInt & mask) >>> 0, mask, prefixLen });
  }
  return out;
}

export function isInternalIp(ip: string, cidrs: Cidr[]): boolean {
  const v = ipToInt(ip);
  if (v === null) return false;
  for (const c of cidrs) if (((v & c.mask) >>> 0) === c.base) return true;
  return false;
}
```

- [ ] **Step 7.3.2: canary-override middleware 테스트**

`canary-override.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { canaryOverrideMiddleware } from "./canary-override.js";
import { parseCidrList } from "../lib/internal-network.js";

function buildApp() {
  const app = new Hono();
  app.use("*", canaryOverrideMiddleware({ internalCidrs: parseCidrList("172.16.0.0/12") }));
  app.get("/echo", (c) => c.json({ override: c.get("canary-override") ?? null }));
  return app;
}

const fire = (h: Record<string, string>) => buildApp().fetch(new Request("http://t/echo", { headers: h }));

describe("canaryOverrideMiddleware (spec §3.4)", () => {
  it("internal IP + valid header → context set", async () => {
    const r = await fire({ "x-canary-override": "candidate:v4-candidate", "x-forwarded-for": "172.17.0.5" });
    expect(await r.json()).toEqual({ override: { target: "candidate", version: "v4-candidate" } });
  });

  it("external IP / malformed / missing XFF → silent ignore (200, override null)", async () => {
    for (const h of [
      { "x-canary-override": "candidate:v4-candidate", "x-forwarded-for": "8.8.8.8" },
      { "x-canary-override": "garbage", "x-forwarded-for": "172.17.0.5" },
      { "x-canary-override": "candidate:v4-candidate" },
    ]) {
      const r = await fire(h);
      expect(r.status).toBe(200);
      expect((await r.json()).override).toBeNull();
    }
  });

  it("multi-IP XFF leftmost is client (172.17.0.5 trusted)", async () => {
    const r = await fire({
      "x-canary-override": "candidate:v4-candidate",
      "x-forwarded-for": "172.17.0.5, 10.0.0.1",
    });
    expect((await r.json()).override).not.toBeNull();
  });
});
```

- [ ] **Step 7.3.3: canary-override middleware 구현**

`canary-override.ts`:

```typescript
// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.4 escape hatch. 외부 IP의 헤더는 silent ignore (정보 노출 X).

import type { MiddlewareHandler } from "hono";
import { isInternalIp, type Cidr } from "../lib/internal-network.js";

export interface CanaryOverride { target: "stable" | "candidate"; version: string; }
export interface CanaryOverrideOptions { internalCidrs: Cidr[]; }

const OVERRIDE_PATTERN = /^(stable|candidate):(v[1-9][0-9]*(?:-candidate|-retired)?)$/;

function clientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0]?.trim() || undefined : undefined;
}

export function canaryOverrideMiddleware(opts: CanaryOverrideOptions): MiddlewareHandler {
  return async (c, next) => {
    const headerValue = c.req.header("x-canary-override");
    if (!headerValue) { await next(); return; }
    const ip = clientIp(c.req.raw);
    if (!ip || !isInternalIp(ip, opts.internalCidrs)) { await next(); return; }
    const m = headerValue.match(OVERRIDE_PATTERN);
    if (!m) { await next(); return; }
    c.set("canary-override", {
      target: m[1] as "stable" | "candidate",
      version: m[2]!,
    } satisfies CanaryOverride);
    await next();
  };
}
```

- [ ] **Step 7.3.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test lib/internal-network middleware/canary-override
git add simulations/enterprise-pm/services/gateway/src/lib/internal-network.ts \
        simulations/enterprise-pm/services/gateway/src/lib/internal-network.test.ts \
        simulations/enterprise-pm/services/gateway/src/middleware/canary-override.ts \
        simulations/enterprise-pm/services/gateway/src/middleware/canary-override.test.ts
git commit -m "feat(sim-gateway): x-canary-override middleware (internal-IP only, spec §3.4)"
```

기대: 4 + 5 = 9 PASS.

### Task 7.4: 다운스트림 요청에 `x-service-version` 헤더 inject

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/lib/proxy.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/lib/proxy.test.ts`
- Modify: `simulations/enterprise-pm/services/gateway/package.json`

spec §3.1 결정 흐름 마지막 단계:

> inject header: x-service-version: v3 (또는 v4)

> `x-service-version` 헤더 값은 `03-identifier-grammar.md` §"service-version header"의 builder로 생성한다. 직접 문자열 조합 금지.

본 task는 `proxyRequest`가 받는 `ProxyArgs`에 `targetVersion?: VersionTag` 필드를 추가하고, Plan A grammar #4(`buildHttpHeader`) + grammar #2(`buildVersionTag`)로 헤더 키/값을 생성한다. 직접 `'x-service-version'` 문자열 사용 금지 — `buildHttpHeader`가 SSOT.

- [ ] **Step 7.4.1: 실패 테스트 추가**

기존 `proxy.test.ts` 끝에 추가:

```typescript
import { describe, it, expect, vi } from "vitest";
import { proxyRequest } from "./proxy.js";
import type { VersionTag } from "sim-identifier-grammar";

describe("proxyRequest version stamp (Plan A grammar #4)", () => {
  async function callAndCapture(targetVersion?: VersionTag): Promise<Headers | undefined> {
    let captured: Headers | undefined;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      captured = new Headers((init as RequestInit).headers ?? {});
      return new Response("{}", { status: 200 });
    });
    try {
      await proxyRequest({
        targetBaseUrl: "http://upstream:4500",
        sourcePath: "/approvals",
        request: new Request("http://gw/approvals"),
        timeoutMs: 1000,
        targetVersion,
      });
    } finally { spy.mockRestore(); }
    return captured;
  }

  it("stable v3 → x-service-version: v3", async () => {
    const h = await callAndCapture({ axis: "version", value: 3, state: "stable" });
    expect(h?.get("x-service-version")).toBe("v3");
  });

  it("candidate v4 → x-service-version: v4-candidate", async () => {
    const h = await callAndCapture({ axis: "version", value: 4, state: "candidate" });
    expect(h?.get("x-service-version")).toBe("v4-candidate");
  });

  it("omit targetVersion → no x-service-version (legacy compat)", async () => {
    const h = await callAndCapture(undefined);
    expect(h?.get("x-service-version")).toBeNull();
  });
});
```

- [ ] **Step 7.4.2: proxy.ts 수정**

`proxy.ts`에 import 추가 + `ProxyArgs`에 `targetVersion?: VersionTag` 필드 추가 + 본문 헤더 inject 단계 추가. 기존 logic(`fetch` 위임, traceparent inject, timeout 처리, 502/504 응답)은 보존:

```typescript
import {
  buildHttpHeader,
  buildVersionTag,
  type VersionTag,
} from "sim-identifier-grammar";

export interface ProxyArgs {
  targetBaseUrl: string;
  sourcePath: string;
  request: Request;
  timeoutMs: number;
  /** 라우팅 결정으로부터 받은 target version. 있으면 x-service-version inject. */
  targetVersion?: VersionTag;
}

const X_SERVICE_VERSION_HEADER = buildHttpHeader({
  kind: "header", domain: "service", attr: "version",
}); // → "x-service-version"

// proxyRequest 본문 — headers 구성 직후, propagation.inject 호출 전:
if (args.targetVersion) {
  headers.set(X_SERVICE_VERSION_HEADER, buildVersionTag(args.targetVersion));
}
```

`simulations/enterprise-pm/services/gateway/package.json`의 `dependencies`에 `"sim-identifier-grammar": "workspace:*"` 추가.

- [ ] **Step 7.4.3: 테스트 통과 + Commit**

```bash
pnpm install
pnpm --filter @sim/gateway test lib/proxy
git add simulations/enterprise-pm/services/gateway/src/lib/proxy.ts \
        simulations/enterprise-pm/services/gateway/src/lib/proxy.test.ts \
        simulations/enterprise-pm/services/gateway/package.json
git commit -m "feat(sim-gateway): inject x-service-version via grammar #4 builder (no string literal)"
```

기대: 기존 proxy 테스트 + 신규 3 케이스 PASS.

### Task 7.5: `POST /admin/routing` 내부 API

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/routes/admin-routing.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routes/admin-routing.test.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/app.ts`

spec §3.2:

> `POST /admin/routing` (gateway 내부 API, controller만 호출)
> payload에 revision 포함, gateway는 자기 revision보다 큰 것만 적용한다.
> controller 재시작 시 gateway가 현재 routing 상태를 회신하고, controller는 그 값을 자신의 출발점으로 sync 한다.

본 task의 endpoint:

- `POST /admin/routing` — controller가 routing entry를 push. payload `{ services: { [name]: RouteEntry } }`. 응답 `{ applied: string[], skipped: { service, reason }[] }`.
- `GET /admin/routing` — gateway 현재 상태 회신 (controller 재시작 시 sync 출발점).

내부 IP 검증은 `internal-network` 모듈을 재사용해 라우트 단위 guard로 부착한다. 외부에서 admin route 접근 시 404 (silent — spec §3.4 정신 일관).

- [ ] **Step 7.5.1: 실패 테스트 작성**

`admin-routing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createAdminRoutingRoute } from "./admin-routing.js";
import { InMemoryRoutingStore } from "../routing/routing-table.js";
import { parseCidrList } from "../lib/internal-network.js";

function makeApp() {
  const store = new InMemoryRoutingStore();
  const app = new Hono();
  app.route("/", createAdminRoutingRoute({
    store,
    internalCidrs: parseCidrList("172.16.0.0/12"),
  }));
  return { app, store };
}
const ENTRY = {
  revision: 1,
  stable: { version: "v3", upstream: "http://sim-approval-api-v1:4500" },
  candidate: null, weight: 0, stickyKey: "user_id" as const,
};
const post = (app: Hono, ip: string, body: unknown) => app.fetch(new Request("http://gw/admin/routing", {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": ip },
  body: JSON.stringify(body),
}));
const get = (app: Hono, ip: string) => app.fetch(new Request("http://gw/admin/routing", {
  headers: { "x-forwarded-for": ip },
}));

describe("POST /admin/routing", () => {
  it("internal + valid → 200 applied=['sim-approval-api']", async () => {
    const { app, store } = makeApp();
    const res = await post(app, "172.17.0.5", { services: { "sim-approval-api": ENTRY } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: ["sim-approval-api"], skipped: [] });
    expect(store.getRoute("sim-approval-api")?.revision).toBe(1);
  });

  it("external IP → 404 silent (no commit)", async () => {
    const { app, store } = makeApp();
    const res = await post(app, "8.8.8.8", { services: { "sim-approval-api": ENTRY } });
    expect(res.status).toBe(404);
    expect(store.getRoute("sim-approval-api")).toBeUndefined();
  });

  it("stale revision → applied=[] + skipped 'stale-revision'", async () => {
    const { app, store } = makeApp();
    store.upsertRoute("sim-approval-api", { ...ENTRY, revision: 5 });
    const res = await post(app, "172.17.0.5", {
      services: { "sim-approval-api": { ...ENTRY, revision: 4 } },
    });
    const body = await res.json();
    expect(body.applied).toEqual([]);
    expect(body.skipped).toEqual([{ service: "sim-approval-api", reason: "stale-revision" }]);
    expect(store.getRoute("sim-approval-api")?.revision).toBe(5);
  });

  it("malformed payload → 400 (no partial commit)", async () => {
    const { app, store } = makeApp();
    const res = await post(app, "172.17.0.5", {
      services: { "sim-approval-api": ENTRY, "sim-pm-api": { ...ENTRY, weight: 200 } },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payload");
    expect(store.getRoute("sim-approval-api")).toBeUndefined();
  });
});

describe("GET /admin/routing", () => {
  it("internal → 200 snapshot; external → 404", async () => {
    const { app, store } = makeApp();
    store.upsertRoute("sim-approval-api", ENTRY);
    expect((await (await get(app, "172.17.0.5")).json()).routes["sim-approval-api"]).toEqual(ENTRY);
    expect((await get(app, "8.8.8.8")).status).toBe(404);
  });
});
```

- [ ] **Step 7.5.2: admin-routing.ts 구현**

```typescript
// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.2 — controller가 push, gateway가 권위. 외부 접근은 404 silent.

import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { type InMemoryRoutingStore, RouteEntrySchema } from "../routing/routing-table.js";
import { isInternalIp, type Cidr } from "../lib/internal-network.js";

const RoutingPushSchema = z.object({
  services: z.record(z.string().min(1), RouteEntrySchema),
});

export interface CreateAdminRoutingOptions {
  store: InMemoryRoutingStore;
  internalCidrs: Cidr[];
}

function clientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0]?.trim() || undefined : undefined;
}

export function createAdminRoutingRoute(opts: CreateAdminRoutingOptions) {
  const r = new Hono();
  const guard: MiddlewareHandler = async (c, next) => {
    const ip = clientIp(c.req.raw);
    if (!ip || !isInternalIp(ip, opts.internalCidrs)) {
      return c.json({ error: "not_found" }, 404);
    }
    await next();
  };
  r.use("/admin/routing", guard);
  r.use("/admin/routing/*", guard);

  r.get("/admin/routing", (c) => c.json(opts.store.dump()));

  r.post("/admin/routing", async (c) => {
    let raw: unknown;
    try { raw = await c.req.json(); }
    catch { return c.json({ error: "invalid_payload", issues: [{ message: "non-JSON body" }] }, 400); }
    const parsed = RoutingPushSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "invalid_payload", issues: parsed.error.issues }, 400);
    }
    // 모든 entry zod 검증 통과 후 store에 commit (atomic-per-request)
    const applied: string[] = [];
    const skipped: Array<{ service: string; reason: string }> = [];
    for (const [name, entry] of Object.entries(parsed.data.services)) {
      const result = opts.store.upsertRoute(name, entry);
      if (result.applied) applied.push(name);
      else skipped.push({ service: name, reason: result.reason ?? "unknown" });
    }
    return c.json({ applied, skipped });
  });

  return r;
}
```

`app.ts`에 admin route 부착 — `createApp` 시그니처 확장:

```typescript
import { createAdminRoutingRoute } from "./routes/admin-routing.js";
import type { InMemoryRoutingStore } from "./routing/routing-table.js";
import type { Cidr } from "./lib/internal-network.js";

export interface AppOptions {
  // ... 기존 필드 ...
  routingStore: InMemoryRoutingStore;
  internalCidrs: Cidr[];
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  app.use("*", requestId);
  app.use("*", traceparent);
  // admin은 unprotected (자체 internal-IP guard)
  app.route("/", createAdminRoutingRoute({
    store: opts.routingStore,
    internalCidrs: opts.internalCidrs,
  }));
  // ... 이하 health/login/protected proxy 동일 ...
}
```

- [ ] **Step 7.5.3: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test routes/admin-routing
git add simulations/enterprise-pm/services/gateway/src/routes/admin-routing.ts \
        simulations/enterprise-pm/services/gateway/src/routes/admin-routing.test.ts \
        simulations/enterprise-pm/services/gateway/src/app.ts
git commit -m "feat(sim-gateway): POST/GET /admin/routing (revision-based, internal-IP guard)"
```

기대: 4 + 2 = 6 PASS.

### Task 7.6: 부팅 시 controller로부터 routing sync (fallback v1=stable, weight=0)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/lib/routing-bootstrap.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/lib/routing-bootstrap.test.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/server.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/config/env.ts`

`bootstrapRouting({ store, controllerUrl, fallbackTargets, fetchTimeoutMs })` 구현. controller `GET /controller/routing`을 호출해 현재 routing을 store에 일괄 upsert. controller 미가동/timeout/non-200/JSON parse 실패 → fallback `{ revision: 0, stable: { version: 'v1', upstream: <env CANARY_TARGETS_JSON.<svc>.v1> }, candidate: null, weight: 0, stickyKey: 'user_id' }`로 store seed. fail-open: bootstrap 실패가 gateway 부팅을 절대 차단하지 않음 (`logger.warn`). server.ts에서 `await bootstrapRouting(...)`을 `serve()` 호출 전에 수행. `AbortSignal.timeout(5_000)` 사용 (CLAUDE.md 네트워크 호출 규약). env.ts에 `CONTROLLER_URL` optional, `INTERNAL_CIDRS` 기본 `172.16.0.0/12`, `CANARY_TARGETS_JSON` (서비스→{v1,v2} url map) 추가. 테스트는 `vi.spyOn(globalThis, "fetch")`로 (a) 200 정상 sync, (b) 5xx → fallback, (c) timeout → fallback, (d) malformed JSON → fallback 4 케이스.

```bash
git add simulations/enterprise-pm/services/gateway/src/lib/routing-bootstrap.ts \
        simulations/enterprise-pm/services/gateway/src/lib/routing-bootstrap.test.ts \
        simulations/enterprise-pm/services/gateway/src/server.ts \
        simulations/enterprise-pm/services/gateway/src/config/env.ts
git commit -m "feat(sim-gateway): bootstrap routing sync from controller (fail-open fallback)"
```

### Task 7.7: 라우팅 통합 테스트 (vitest, mock JWT)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/routing/integration.test.ts`

`createApp({ routingStore, internalCidrs, ... })`로 테스트 앱 생성 → `POST /admin/routing`으로 weight=10 + candidate=v4-candidate 푸시 → 다른 user_id 1000개로 `/approvals` 호출 → upstream URL 분포가 [80, 120] 범위(10% ± 노이즈) 검증. JWT는 `lib/jwt.ts`의 `signBitmapJwt`로 mock 발급. upstream은 `vi.spyOn(globalThis, "fetch")`로 응답 captured하여 hit URL로 분포 추정. 추가 케이스: (a) weight=0 rollback 후 모든 사용자 v1로 회귀, (b) `x-canary-override`로 강제 candidate, (c) 동일 user_id의 weight 5%→15% 변경 시 같은 결정 유지(spec §3.3 deterministic).

```bash
pnpm --filter @sim/gateway test routing/integration
git add simulations/enterprise-pm/services/gateway/src/routing/integration.test.ts
git commit -m "test(sim-gateway): routing integration — sticky distribution + override + rollback"
```

### Task 7.8: 기존 시나리오 1~8 무회귀

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/integration.test.ts` (기존)
- Modify: `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts`

기존 8 시나리오(login → JWT 발급 → bitmap version → proxy → traceparent 등)는 routing table에 candidate가 없는 상태(`candidate: null, weight: 0`)에서 항상 stable로 라우팅된다 (decideRoute의 `no-candidate` 분기). 본 task는 기존 통합 테스트의 `createApp` 호출부에 `routingStore: new InMemoryRoutingStore()` + `internalCidrs: parseCidrList("172.16.0.0/12")` 인자 추가. proxy-routes.ts는 `routingStore.getRoute(serviceKey)`가 undefined면 기존 `targets[serviceKey]`로 fall-through (legacy 호환 분기 — Plan C 머지 전후 sim 모든 시나리오 동일 동작 보장).

```bash
pnpm --filter @sim/gateway test
git add simulations/enterprise-pm/services/gateway/src/integration.test.ts \
        simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts
git commit -m "test(sim-gateway): 1~8 시나리오 무회귀 (routing 미설정 → legacy fall-through)"
```

기대: 기존 통합 테스트 전부 PASS, 신규 시나리오 분포/override/rollback PASS.
