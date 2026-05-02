# Stage 2 — Gateway Sticky Consistency Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gateway에 `GET /admin/routing/sticky-consistency` endpoint 추가. routing decision history를 메모리 ring buffer로 기록 + endpoint query 시 user_id별 version 일관성 ratio 계산.

**Architecture:** Stage 7 gateway routing module 위에 sticky decision tracker 추가. 라우팅 결정마다 `{ user_id, version, at }` 기록. endpoint는 최근 N decision을 user별 그룹핑해서 inconsistency 검출.

**Tech Stack:** TypeScript ES2023, Hono, vitest, sim-internal-network (Stage 1a 결과 hono-middleware).

**Spec 인용:** `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §9 Stage 2.

---

### File Structure (Stage 2)

| 종류 | 경로 |
|---|---|
| Create | `simulations/enterprise-pm/services/gateway/src/routing/sticky-decision-tracker.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/routing/sticky-decision-tracker.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/admin/sticky-consistency.handler.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/admin/sticky-consistency.handler.test.ts` |
| Create | `simulations/enterprise-pm/services/gateway/src/admin/sticky-consistency.contract.test.ts` |
| Modify | `simulations/enterprise-pm/services/gateway/src/routing/route-decision.ts` (tracker DI wrapper) |
| Modify | `simulations/enterprise-pm/services/gateway/src/routing/route-decision.test.ts` |
| Modify | `simulations/enterprise-pm/services/gateway/src/app.ts` (admin route + middleware) |
| Modify | `simulations/enterprise-pm/services/gateway/src/config/env.ts` (`SIM_GATEWAY_STICKY_TRACKER_SIZE`) |
| Modify | `simulations/enterprise-pm/services/gateway/src/server.ts` (tracker 인스턴스화 + DI) |
| Modify | `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts` (`decideRouteWithTracking`) |
| Modify | `simulations/enterprise-pm/services/gateway/package.json` (`sim-internal-network` 의존) |

---

### Task 2.1 — `StickyDecisionTracker` 클래스 (메모리 ring buffer)

**Files:**
- Create: `routing/sticky-decision-tracker.ts`, `routing/sticky-decision-tracker.test.ts`
- Modify: `config/env.ts`

spec §9 Stage 2: "구현: gateway routing decision을 메모리 ring buffer로 기록 (`{ user_id, version, at }`) + endpoint query 시 ratio 계산."

순수 메모리 클래스 — 외부 의존(KV/DB) 금지. tracker 크기는 `SIM_GATEWAY_STICKY_TRACKER_SIZE` (default 1000)로 부팅 시 주입 (CLAUDE.md 환경변수 규약 — `process.env` 직접 접근 금지, `config/env.ts` zod 스키마 경유).

내부 인터페이스:
- `record(userId, version, at)` — push, 가장 오래된 것 evict.
- `getRatio(window?)` → `{ ratio, sample, inconsistentUsers, window: { from, to } }`.
- `getInconsistentUsers(window?)` → 두 개 이상 version을 본 user_id 정렬 list.
- `dump(window?)` — 분석용 read-only copy.
- `Window = { from?: Date; to?: Date }` — handler가 `?windowMinutes=N` 변환 후 주입.

- [ ] **Step 2.1.1: 실패 테스트 작성**

`sticky-decision-tracker.test.ts` (5 케이스):

```typescript
import { describe, it, expect } from "vitest";
import { StickyDecisionTracker } from "./sticky-decision-tracker.js";

describe("StickyDecisionTracker", () => {
  it("ring eviction: maxSize 초과 시 오래된 것 폐기", () => {
    const t = new StickyDecisionTracker({ maxSize: 3 });
    const at = new Date("2026-05-02T00:00:00Z");
    for (let i = 0; i < 5; i++) t.record(`u-${i}`, "v3", new Date(at.getTime() + i * 1000));
    expect(t.dump().map((d) => d.userId)).toEqual(["u-2", "u-3", "u-4"]);
  });
  it("전 user 단일 version → ratio=1", () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    for (let i = 0; i < 10; i++) t.record(`u-${i}`, "v3", new Date());
    expect(t.getRatio()).toMatchObject({ ratio: 1, sample: 10, inconsistentUsers: 0 });
  });
  it("inconsistent 1명 → ratio≈0.9", () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    const at = new Date();
    for (let i = 0; i < 10; i++) t.record(`u-${i}`, "v3", at);
    t.record("u-1", "v4-candidate", new Date(at.getTime() + 1000));
    const r = t.getRatio();
    expect(r.inconsistentUsers).toBe(1);
    expect(r.ratio).toBeCloseTo(0.9, 5);
  });
  it("getInconsistentUsers + window 적용", () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    const t0 = new Date("2026-05-02T00:00:00Z");
    t.record("u-1", "v3", t0);
    t.record("u-1", "v4-candidate", new Date(t0.getTime() + 60_000));
    t.record("u-2", "v3", t0);
    expect(t.getInconsistentUsers()).toEqual(["u-1"]);
    expect(t.getInconsistentUsers({ from: t0, to: new Date(t0.getTime() + 30_000) })).toEqual([]);
  });
  it("empty buffer → ratio 1, sample 0", () => {
    expect(new StickyDecisionTracker({ maxSize: 100 }).getRatio()).toMatchObject({
      ratio: 1, sample: 0, inconsistentUsers: 0,
    });
  });
});
```

- [ ] **Step 2.1.2: 테스트 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter @sim/gateway test routing/sticky-decision-tracker
```

기대: FAIL (모듈 미정의).

- [ ] **Step 2.1.3: 최소 구현**

`sticky-decision-tracker.ts`:

```typescript
// @def.boundary sim-gateway / @def.doc gateway-sticky-consistency
// spec 2026-05-02 §9 Stage 2 — sticky decision ring buffer (메모리 only).

export interface StickyDecision { userId: string; version: string; at: Date; }
export interface Window { from?: Date; to?: Date; }
export interface RatioResult {
  ratio: number; sample: number; inconsistentUsers: number;
  window: { from: string; to: string };
}

export class StickyDecisionTracker {
  private readonly buffer: StickyDecision[] = [];
  private readonly maxSize: number;
  constructor(opts: { maxSize: number }) {
    if (!Number.isInteger(opts.maxSize) || opts.maxSize <= 0) {
      throw new Error(`maxSize must be positive integer, got ${opts.maxSize}`);
    }
    this.maxSize = opts.maxSize;
  }
  record(userId: string, version: string, at: Date): void {
    if (!userId || !version) return;
    this.buffer.push({ userId, version, at });
    if (this.buffer.length > this.maxSize) this.buffer.shift();
  }
  private filter(w?: Window): StickyDecision[] {
    if (!w || (!w.from && !w.to)) return [...this.buffer];
    return this.buffer.filter((d) => (!w.from || d.at >= w.from) && (!w.to || d.at <= w.to));
  }
  private groupBy(sample: StickyDecision[]): Map<string, Set<string>> {
    const seen = new Map<string, Set<string>>();
    for (const d of sample) {
      let s = seen.get(d.userId);
      if (!s) { s = new Set(); seen.set(d.userId, s); }
      s.add(d.version);
    }
    return seen;
  }
  dump(w?: Window): StickyDecision[] { return this.filter(w).map((d) => ({ ...d })); }
  getInconsistentUsers(w?: Window): string[] {
    return [...this.groupBy(this.filter(w))].filter(([, v]) => v.size > 1).map(([k]) => k).sort();
  }
  getRatio(w?: Window): RatioResult {
    const sample = this.filter(w);
    const seen = this.groupBy(sample);
    const total = seen.size;
    const inconsistent = [...seen.values()].filter((v) => v.size > 1).length;
    const ratio = total === 0 ? 1 : 1 - inconsistent / total;
    const from = w?.from?.toISOString() ?? sample[0]?.at.toISOString() ?? new Date(0).toISOString();
    const to = w?.to?.toISOString() ?? sample[sample.length - 1]?.at.toISOString() ?? new Date(0).toISOString();
    return { ratio, sample: sample.length, inconsistentUsers: inconsistent, window: { from, to } };
  }
}
```

`config/env.ts`에 `SIM_GATEWAY_STICKY_TRACKER_SIZE: z.coerce.number().int().positive().default(1000)` 추가.

- [ ] **Step 2.1.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test routing/sticky-decision-tracker
git add simulations/enterprise-pm/services/gateway/src/routing/sticky-decision-tracker.ts \
        simulations/enterprise-pm/services/gateway/src/routing/sticky-decision-tracker.test.ts \
        simulations/enterprise-pm/services/gateway/src/config/env.ts
git commit -m "feat(sim-gateway): StickyDecisionTracker ring buffer + ratio (spec §9 Stage 2)"
```

기대: 5 PASS.

- [ ] **Step 2.1.5: 회귀 검증**

```bash
pnpm --filter @sim/gateway test
```

기대: 기존 routing/proxy/admin-routing 테스트 무회귀.

---

### Task 2.2 — Routing decision에 `tracker.record` 호출 (DI wrapper)

**Files:**
- Modify: `routing/route-decision.ts`, `routing/route-decision.test.ts`

기존 `decideRoute`는 순수 함수다 (Stage 7 §3.1 요구). 본 task는 **decoration 패턴**으로 `decideRouteWithTracking({ tracker, entry, userId, now })`를 신설한다 — `decideRoute` 자체는 그대로. tracker undefined 또는 anonymous(userId 없음)면 record 생략 (decision은 동일). 이 wrapper는 proxy-routes.ts에서 호출 (Task 2.4에서 wiring).

- [ ] **Step 2.2.1: 실패 테스트 추가**

`route-decision.test.ts` 끝에 추가:

```typescript
import { StickyDecisionTracker } from "./sticky-decision-tracker.js";
import { decideRouteWithTracking } from "./route-decision.js";

describe("decideRouteWithTracking (Stage 2 — tracker DI)", () => {
  const entry = {
    revision: 1,
    stable: { version: "v3", upstream: "http://sim-approval-api-v1:4500" },
    candidate: { version: "v4-candidate", upstream: "http://sim-approval-api-v2:4500" },
    weight: 50, stickyKey: "user_id" as const,
  };
  it("결정된 version으로 tracker.record 호출됨", () => {
    const tracker = new StickyDecisionTracker({ maxSize: 100 });
    const at = new Date("2026-05-02T00:00:00Z");
    decideRouteWithTracking({ tracker, entry, userId: "u-42", now: at });
    const all = tracker.dump();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ userId: "u-42", at });
    expect(["v3", "v4-candidate"]).toContain(all[0]?.version);
  });
  it("tracker undefined → record 생략 (legacy compat)", () => {
    const r = decideRouteWithTracking({ tracker: undefined, entry, userId: "u-1", now: new Date() });
    expect(["v3", "v4-candidate"]).toContain(r.version);
  });
  it("anonymous (userId undefined) → record 생략", () => {
    const tracker = new StickyDecisionTracker({ maxSize: 100 });
    decideRouteWithTracking({ tracker, entry, userId: undefined, now: new Date() });
    expect(tracker.dump()).toHaveLength(0);
  });
});
```

- [ ] **Step 2.2.2: 테스트 실패 확인**

```bash
pnpm --filter @sim/gateway test routing/route-decision
```

기대: FAIL (`decideRouteWithTracking` 미정의).

- [ ] **Step 2.2.3: `decideRouteWithTracking` 구현**

`route-decision.ts` 끝에 추가:

```typescript
import type { StickyDecisionTracker } from "./sticky-decision-tracker.js";

export interface DecideRouteWithTrackingArgs extends DecideRouteArgs {
  tracker?: StickyDecisionTracker;
  now?: Date;
}

export function decideRouteWithTracking(args: DecideRouteWithTrackingArgs): RouteDecision {
  const decision = decideRoute({ entry: args.entry, userId: args.userId });
  // anonymous는 sticky tracking 의미 없음 (spec §9: user_id별 version 일관성)
  if (args.tracker && args.userId) {
    args.tracker.record(args.userId, decision.version, args.now ?? new Date());
  }
  return decision;
}
```

- [ ] **Step 2.2.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test routing/route-decision
git add simulations/enterprise-pm/services/gateway/src/routing/route-decision.ts \
        simulations/enterprise-pm/services/gateway/src/routing/route-decision.test.ts
git commit -m "feat(sim-gateway): decideRouteWithTracking — sticky tracker DI wrapper"
```

기대: Task 7.2 기존 + 신규 3건 PASS.

- [ ] **Step 2.2.5: routing 디렉터리 무회귀**

```bash
pnpm --filter @sim/gateway test routing/
```

기대: 기존 decideRoute 시그니처 변동 없음 — 전 PASS.

---

### Task 2.3 — `AdminStickyConsistencyHandler` (Hono)

**Files:**
- Create: `admin/sticky-consistency.handler.ts`, `admin/sticky-consistency.handler.test.ts`
- Modify: `package.json` (`sim-internal-network` workspace 의존)

spec §9 Stage 2 응답 shape:

```ts
{ ratio: number, sample: number, inconsistentUsers: number, window: { from: ISO, to: ISO } }
```

`internalIpMiddleware`는 Stage 1a `packages/sim-internal-network/src/hono-middleware.ts`를 그대로 import — 외부 IP 요청 → RFC 7807 + 404 silent (spec §3, §11). query string `?windowMinutes=N` (자연수)으로 `now - N*60s ~ now` 윈도우 ratio. zod 검증 실패 → 400 RFC 7807.

- [ ] **Step 2.3.1: 실패 테스트 작성**

`sticky-consistency.handler.test.ts` (5 케이스):

```typescript
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createStickyConsistencyHandler } from "./sticky-consistency.handler.js";
import { StickyDecisionTracker } from "../routing/sticky-decision-tracker.js";
import { honoInternalIpMiddleware, parseCidrList } from "sim-internal-network";

const NOW = new Date("2026-05-02T01:00:00Z");
function makeApp(tracker: StickyDecisionTracker) {
  const app = new Hono();
  app.use("/admin/*", honoInternalIpMiddleware({ internalCidrs: parseCidrList("172.16.0.0/12") }));
  app.get("/admin/routing/sticky-consistency",
    createStickyConsistencyHandler({ tracker, now: () => NOW }));
  return app;
}
const fire = (app: Hono, ip: string, qs = "") =>
  app.fetch(new Request(`http://gw/admin/routing/sticky-consistency${qs}`, { headers: { "x-forwarded-for": ip } }));

describe("GET /admin/routing/sticky-consistency", () => {
  it("internal + 빈 buffer → 200 ratio=1 sample=0", async () => {
    const r = await fire(makeApp(new StickyDecisionTracker({ maxSize: 100 })), "172.17.0.5");
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ ratio: 1, sample: 0, inconsistentUsers: 0 });
    expect(typeof body.window.from).toBe("string");
    expect(typeof body.window.to).toBe("string");
  });
  it("inconsistent 1명 → ratio≈0.9 sample=11", async () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    const at = new Date("2026-05-02T00:30:00Z");
    for (let i = 0; i < 10; i++) t.record(`u-${i}`, "v3", at);
    t.record("u-1", "v4-candidate", at);
    const body = await (await fire(makeApp(t), "172.17.0.5")).json();
    expect(body).toMatchObject({ inconsistentUsers: 1, sample: 11 });
    expect(body.ratio).toBeCloseTo(0.9, 5);
  });
  it("외부 IP → 404 silent", async () => {
    const r = await fire(makeApp(new StickyDecisionTracker({ maxSize: 100 })), "8.8.8.8");
    expect(r.status).toBe(404);
  });
  it("?windowMinutes=10 → 윈도우 밖 records 제외", async () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    t.record("u-99", "v3", new Date(NOW.getTime() - 3600_000));
    t.record("u-99", "v4-candidate", new Date(NOW.getTime() - 3600_000));
    t.record("u-1", "v3", new Date(NOW.getTime() - 300_000));
    const body = await (await fire(makeApp(t), "172.17.0.5", "?windowMinutes=10")).json();
    expect(body).toMatchObject({ sample: 1, inconsistentUsers: 0, ratio: 1 });
  });
  it("?windowMinutes=-5 → 400 RFC 7807", async () => {
    const r = await fire(makeApp(new StickyDecisionTracker({ maxSize: 100 })), "172.17.0.5", "?windowMinutes=-5");
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body).toMatchObject({ status: 400 });
    expect(body.title).toBeDefined();
  });
});
```

- [ ] **Step 2.3.2: 테스트 실패 확인 + 의존 추가**

`package.json`의 `dependencies`에 `"sim-internal-network": "workspace:*"` 추가.

```bash
pnpm install
pnpm --filter @sim/gateway test admin/sticky-consistency.handler
```

기대: FAIL (`createStickyConsistencyHandler` 미정의).

- [ ] **Step 2.3.3: handler 구현**

`sticky-consistency.handler.ts`:

```typescript
// @def.boundary sim-gateway / @def.doc gateway-sticky-consistency
// spec 2026-05-02 §9 Stage 2. internal IP middleware는 호출자(app.ts)에서 부착.

import type { Handler } from "hono";
import { z } from "zod";
import type { StickyDecisionTracker } from "../routing/sticky-decision-tracker.js";

const QuerySchema = z.object({ windowMinutes: z.coerce.number().int().positive().optional() });

export interface StickyConsistencyResponse {
  ratio: number; sample: number; inconsistentUsers: number;
  window: { from: string; to: string };
}

export function createStickyConsistencyHandler(opts: {
  tracker: StickyDecisionTracker; now?: () => Date;
}): Handler {
  const now = opts.now ?? (() => new Date());
  return (c) => {
    const parsed = QuerySchema.safeParse({ windowMinutes: c.req.query("windowMinutes") });
    if (!parsed.success) {
      return c.json({
        type: "https://qa-sdk.dev/errors/validation",
        title: "invalid query", status: 400,
        detail: parsed.error.issues.map((i) => i.message).join("; "),
      }, 400);
    }
    const window = parsed.data.windowMinutes
      ? { from: new Date(now().getTime() - parsed.data.windowMinutes * 60_000), to: now() }
      : undefined;
    const r = opts.tracker.getRatio(window);
    const body: StickyConsistencyResponse = {
      ratio: r.ratio, sample: r.sample, inconsistentUsers: r.inconsistentUsers, window: r.window,
    };
    return c.json(body);
  };
}
```

- [ ] **Step 2.3.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test admin/sticky-consistency.handler
git add simulations/enterprise-pm/services/gateway/src/admin/sticky-consistency.handler.ts \
        simulations/enterprise-pm/services/gateway/src/admin/sticky-consistency.handler.test.ts \
        simulations/enterprise-pm/services/gateway/package.json
git commit -m "feat(sim-gateway): sticky-consistency handler + RFC 7807 query validation"
```

기대: 5 PASS.

- [ ] **Step 2.3.5: 패키지 전체 회귀**

```bash
pnpm --filter @sim/gateway test
```

기대: 기존 routing/proxy/admin-routing 무회귀.

---

### Task 2.4 — gateway `app.ts`/`server.ts`/`proxy-routes.ts` wiring

**Files:**
- Modify: `app.ts`, `app.test.ts`, `server.ts`, `routes/proxy-routes.ts`

`createApp` 시그니처에 `stickyTracker`를 추가하고, `/admin/routing/sticky-consistency` 경로에 `honoInternalIpMiddleware` + handler를 부착한다 (Task 7.5의 admin/routing 라우트는 자체 guard 사용 — 본 stage는 별도 prefix). proxy-routes.ts의 라우팅 결정 호출부를 `decideRouteWithTracking`으로 교체. server.ts는 부팅 시 `new StickyDecisionTracker({ maxSize: env.SIM_GATEWAY_STICKY_TRACKER_SIZE })` 인스턴스화.

- [ ] **Step 2.4.1: app wiring 테스트 추가**

`app.test.ts` 끝에 추가:

```typescript
import { StickyDecisionTracker } from "./routing/sticky-decision-tracker.js";
import { InMemoryRoutingStore } from "./routing/routing-table.js";
import { parseCidrList } from "sim-internal-network";

describe("app wiring — sticky-consistency endpoint", () => {
  it("internal → 200 / external → 404", async () => {
    const tracker = new StickyDecisionTracker({ maxSize: 100 });
    tracker.record("u-1", "v3", new Date());
    const app = createApp({
      routingStore: new InMemoryRoutingStore(),
      stickyTracker: tracker,
      internalCidrs: parseCidrList("172.16.0.0/12"),
      // 기존 인자(targets, jwtSecret 등)는 기존 헬퍼 그대로
    } as Parameters<typeof createApp>[0]);
    const ok = await app.fetch(new Request("http://gw/admin/routing/sticky-consistency",
      { headers: { "x-forwarded-for": "172.17.0.5" } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).sample).toBe(1);
    const ng = await app.fetch(new Request("http://gw/admin/routing/sticky-consistency",
      { headers: { "x-forwarded-for": "8.8.8.8" } }));
    expect(ng.status).toBe(404);
  });
});
```

- [ ] **Step 2.4.2: app.ts에 라우트 부착**

```typescript
import { honoInternalIpMiddleware } from "sim-internal-network";
import { createStickyConsistencyHandler } from "./admin/sticky-consistency.handler.js";
import type { StickyDecisionTracker } from "./routing/sticky-decision-tracker.js";

export interface AppOptions {
  // ... 기존 필드 유지 (routingStore, internalCidrs 등) ...
  stickyTracker: StickyDecisionTracker;
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  // ... 기존 미들웨어/라우트 ...
  app.use("/admin/routing/sticky-consistency",
    honoInternalIpMiddleware({ internalCidrs: opts.internalCidrs }));
  app.get("/admin/routing/sticky-consistency",
    createStickyConsistencyHandler({ tracker: opts.stickyTracker }));
  // ... 기존 proxy routes ...
}
```

`proxy-routes.ts`에서 라우팅 결정 호출부를 `decideRouteWithTracking`으로 교체 (`tracker`는 closure 의존성):

```typescript
import { decideRouteWithTracking } from "../routing/route-decision.js";
import type { StickyDecisionTracker } from "../routing/sticky-decision-tracker.js";

export function createProxyRoutes(deps: { /* ... */ stickyTracker: StickyDecisionTracker }) {
  // 라우팅 결정 시점:
  const decision = decideRouteWithTracking({ tracker: deps.stickyTracker, entry, userId });
}
```

- [ ] **Step 2.4.3: server.ts에서 tracker 인스턴스화**

```typescript
import { StickyDecisionTracker } from "./routing/sticky-decision-tracker.js";

const stickyTracker = new StickyDecisionTracker({ maxSize: env.SIM_GATEWAY_STICKY_TRACKER_SIZE });
const app = createApp({ /* ... */ stickyTracker });
```

- [ ] **Step 2.4.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test app.test
git add simulations/enterprise-pm/services/gateway/src/app.ts \
        simulations/enterprise-pm/services/gateway/src/app.test.ts \
        simulations/enterprise-pm/services/gateway/src/server.ts \
        simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts
git commit -m "feat(sim-gateway): wire sticky-consistency route + tracker DI in proxy-routes"
```

기대: 신규 wiring + 기존 app.test PASS.

- [ ] **Step 2.4.5: gateway 전 회귀 확인**

```bash
pnpm --filter @sim/gateway test
```

기대: 기존 routing/proxy/admin-routing/integration 무회귀, 신규 sticky 5 + DI 3 + handler 5 + wiring 1 = 14건 추가 PASS.

---

### Task 2.5 — sim-handles ↔ endpoint contract 검증

**Files:**
- Create: `admin/sticky-consistency.contract.test.ts`
- Modify: `admin/sticky-consistency.handler.ts` (build-time satisfies 어설션)

spec §10 Contract 행: "Stage 2 gateway | sim-handles `gateway-sticky-consistency` 타입 import."

sim-handles 측이 노출하는 `GatewayStickyConsistencyResponse` 타입을 import → handler 응답이 정확히 그 shape에 부합함을 (a) typecheck (`extends` ternary) (b) 단위 테스트로 검증한다. 본 stage는 PR-A (sim-handles factory) 머지 후 시작하므로 import 경로는 항상 사용 가능 (overview 00 §4).

- [ ] **Step 2.5.1: contract test 작성**

`sticky-consistency.contract.test.ts`:

```typescript
import { describe, it, expect, expectTypeOf } from "vitest";
import { Hono } from "hono";
import { createStickyConsistencyHandler, type StickyConsistencyResponse } from "./sticky-consistency.handler.js";
import { StickyDecisionTracker } from "../routing/sticky-decision-tracker.js";
import { honoInternalIpMiddleware, parseCidrList } from "sim-internal-network";
import type { GatewayStickyConsistencyResponse } from "@sim/scenarios/runner/sim-handles/gateway-sticky-consistency";

describe("Stage 2 contract — gateway ↔ sim-handles", () => {
  it("gateway shape ≡ sim-handles 기대 shape (양방향 typecheck)", () => {
    expectTypeOf<StickyConsistencyResponse>().toMatchTypeOf<GatewayStickyConsistencyResponse>();
    expectTypeOf<GatewayStickyConsistencyResponse>().toMatchTypeOf<StickyConsistencyResponse>();
  });
  it("실제 JSON 키 셋 + 타입 매치", async () => {
    const t = new StickyDecisionTracker({ maxSize: 10 });
    t.record("u-1", "v3", new Date("2026-05-02T00:00:00Z"));
    const app = new Hono();
    app.use("/admin/*", honoInternalIpMiddleware({ internalCidrs: parseCidrList("172.16.0.0/12") }));
    app.get("/admin/routing/sticky-consistency", createStickyConsistencyHandler({ tracker: t }));
    const res = await app.fetch(new Request("http://gw/admin/routing/sticky-consistency",
      { headers: { "x-forwarded-for": "172.17.0.5" } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GatewayStickyConsistencyResponse;
    expect(Object.keys(body).sort()).toEqual(["inconsistentUsers", "ratio", "sample", "window"]);
    expect(typeof body.ratio).toBe("number");
    expect(typeof body.window.from).toBe("string");
    expect(() => new Date(body.window.from)).not.toThrow();
    expect(() => new Date(body.window.to)).not.toThrow();
  });
});
```

- [ ] **Step 2.5.2: 테스트 실패 확인**

```bash
pnpm --filter @sim/gateway test admin/sticky-consistency.contract
```

기대: PASS (sim-handles 모듈이 PR-A에서 export 추가됨). FAIL 시 sim-handles 측 export 누락 — Stage 11과 본 plan의 머지 순서를 점검 (PR-B는 PR-A 머지 후 시작 — overview 00 §4).

- [ ] **Step 2.5.3: build-time drift gate 추가**

`sticky-consistency.handler.ts` 끝:

```typescript
import type { GatewayStickyConsistencyResponse } from "@sim/scenarios/runner/sim-handles/gateway-sticky-consistency";

// build-time drift gate — handler 응답 타입 ≡ sim-handles 기대 shape (양방향)
const _typecheck1: StickyConsistencyResponse extends GatewayStickyConsistencyResponse ? true : never = true;
const _typecheck2: GatewayStickyConsistencyResponse extends StickyConsistencyResponse ? true : never = true;
void _typecheck1; void _typecheck2;
```

- [ ] **Step 2.5.4: 테스트 통과 + Commit**

```bash
pnpm --filter @sim/gateway test admin/sticky-consistency.contract
git add simulations/enterprise-pm/services/gateway/src/admin/sticky-consistency.contract.test.ts \
        simulations/enterprise-pm/services/gateway/src/admin/sticky-consistency.handler.ts
git commit -m "test(sim-gateway): contract test sim-handles ↔ sticky-consistency endpoint"
```

기대: 2 PASS.

- [ ] **Step 2.5.5: typecheck 회귀**

```bash
pnpm --filter @sim/gateway typecheck
```

기대: 0 errors. drift 발생 시 sim-handles export 타입을 spec §9 응답 shape와 일치시키는 패치는 sim-handles 측 PR로 분리한다.

---

### Task 2.6 — Stage 2 통합 검증 + 시나리오 1~8 무회귀

**Files:** (검증 only)

PR-B 머지 직전 게이트:
- gateway 빌드 PASS (tsc).
- gateway 전 테스트 PASS (Task 2.1~2.5 통합).
- Stage 7의 시나리오 1~8 무회귀 — `decideRouteWithTracking`은 `decideRoute`의 superset이고 tracker 효과는 record 기록뿐 → 결정·헤더·응답 모두 동일.

- [ ] **Step 2.6.1: gateway 빌드 PASS**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter @sim/gateway build
```

기대: tsc 빌드 PASS, dist/ 산출물 생성.

- [ ] **Step 2.6.2: gateway 전 테스트 PASS**

```bash
pnpm --filter @sim/gateway test
```

기대: 모든 vitest suite PASS. 신규 sticky-consistency 5+3+5+1+2 = 16건 추가 카운트 확인.

- [ ] **Step 2.6.3: 시나리오 1~8 무회귀**

```bash
pnpm --filter @sim/gateway test integration
```

기대: 기존 1~8 시나리오 통합 테스트 (login, JWT, bitmap, traceparent 등) 전건 PASS.

- [ ] **Step 2.6.4: sim-handles 측 단위 테스트 (optional)**

```bash
pnpm --filter @sim/scenarios test runner/sim-handles/gateway-sticky-consistency
```

기대: factory + fetchImpl injection 단위 테스트 PASS. 본 plan의 책임 범위는 아니나 머지 안정성을 높임.

- [ ] **Step 2.6.5: 커밋 매핑 확인 + PR 본문 정리**

```bash
git log --oneline simulations/enterprise-pm/services/gateway/src/routing/sticky-decision-tracker.ts \
                  simulations/enterprise-pm/services/gateway/src/admin/
```

기대: 본 stage 도입 신규/변경 파일에 6 커밋 매핑 (Task 2.1~2.5 + wiring + 회귀 검증). 누락 시 해당 task를 먼저 마무리한다.

PR-B 본문 포함 항목:
- spec §9 Stage 2 응답 shape 그대로 인용.
- Stage 1a `sim-internal-network` 의존 명시 (PR-A 머지 선행 필수).
- 본 plan Task 2.1~2.5 commit 6건 링크.
- `pnpm --filter @sim/gateway test` 결과 캡처 (총 PASS 카운트).
- 시나리오 1~8 무회귀 캡처.

---

## 머지 게이트 요약 + 후속 작업

- [x] Task 2.1 — StickyDecisionTracker (5 unit) / 2.2 — DI wrapper (3 unit) / 2.3 — handler (5 unit)
- [x] Task 2.4 — app/server/proxy-routes wiring (1 wiring) / 2.5 — contract test (2 + typecheck drift gate)
- [x] Task 2.6 — gateway 전 테스트 + 시나리오 1~8 무회귀 + PR-B 본문 정리

본 plan은 PR-B 단독 머지 가능. 머지 후 (overview 00 §4): (a) 시나리오 9~17 e2e 검증 — Stage 1·3·4 머지 후 사용자 환경. (b) 운영급 admin 인증 (admin token, mTLS) — 별도 sub-project (spec §1 범위 밖). (c) sticky tracker 영속화 — 24h soak 시 restart 손실 허용 여부 결정 후 별도 plan.
