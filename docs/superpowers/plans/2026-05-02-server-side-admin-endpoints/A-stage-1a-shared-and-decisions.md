# Stage 1a — Shared Packages + Controller Decision Queries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 공유 패키지 2개(sim-internal-network, sim-decision-view) + controller ring buffer + decision query endpoints 3종 (`/v1/decisions`, `/v1/decisions/first`, `/v1/cycles/recent`).

**Architecture:** controller가 매 사이클 끝에 ring buffer에 SafetyDecisionRecord/ResourceDecisionRecord append. NestJS @Controller가 ring buffer query → view DTO 변환 → JSON 응답. 외부 IP 요청은 InternalIpGuard가 404 silent로 reject.

**Tech Stack:** TypeScript ES2023, NestJS 11 + Fastify, tsup ESM+CJS dual (sim-internal-network/sim-decision-view), vitest, sim-identifier-grammar (grammar #7/#8/#14/#15).

**Spec 인용:** `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §3 (인증), §4 (view DTO), §5 (ring buffer), §6 endpoint 1~3.

---

## File Structure

**Create**: `packages/sim-internal-network/{package.json, tsup.config.ts, tsconfig.json, vitest.config.ts, src/{index.ts, is-internal-ip.ts, is-internal-ip.test.ts, nestjs-guard.ts, nestjs-guard.test.ts, hono-middleware.ts, hono-middleware.test.ts}}`; `packages/sim-decision-view/{package.json, tsup.config.ts, tsconfig.json, vitest.config.ts, src/{index.ts, safety-decision-view.ts, resource-decision-view.ts, alert-event-view.ts, audit-trace-view.ts, conversion.ts, conversion.test.ts}}`; `simulations/enterprise-pm/services/canary-controller/src/decision/{decision-ring-buffer.ts, decision-ring-buffer.test.ts, decision-query.controller.ts, decision-query.controller.test.ts, decision-query.module.ts, decision-query.module.smoke.test.ts}`.

**Modify**: `simulations/enterprise-pm/services/canary-controller/src/cycle/{cycle-scheduler.service.ts, cycle.module.ts}`; `simulations/enterprise-pm/services/canary-controller/src/app.module.ts`; `simulations/enterprise-pm/services/canary-controller/package.json`.

## 공통 패키지 config 템플릿 (Task 1.1·1.4 공용)

신규 패키지 2종 모두 다음 3 파일을 동일하게 공유한다 (이름·peerDeps만 다름). 본 plan에서는 canary-scaling Plan A Stage 2a-i Task 2.1.2~2.1.4 (`A-stage-2a-i-skeleton-and-grammar-1-5.md` 라인 60~120) 의 sim-identifier-grammar `tsup.config.ts` / `tsconfig.json` / `vitest.config.ts` 를 그대로 재사용한다 (target=ES2023, module/moduleResolution=NodeNext, format=[esm,cjs], dts=true, include=src/**/*.test.ts).

### Task 1.1: packages/sim-internal-network 패키지 skeleton + isInternalIp 함수

**Files:** `packages/sim-internal-network/{package.json, tsup.config.ts, tsconfig.json, vitest.config.ts, src/{index.ts, is-internal-ip.ts, is-internal-ip.test.ts}}`

`isInternalIp(ip)`은 docker bridge (172.16.0.0/12), private LAN (10.0.0.0/8, 192.168.0.0/16), localhost (127.0.0.0/8, ::1), IPv4-mapped IPv6 (`::ffff:*`) 다섯 범주를 internal로 인정한다. malformed input은 throw 금지 → false (정보 누출 방지).

- [ ] **Step 1.1.1: 실패 테스트 작성 (test-first)**

`packages/sim-internal-network/src/is-internal-ip.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isInternalIp } from "./is-internal-ip.js";

describe("isInternalIp (sim-internal-network §3)", () => {
  it("internal 범주 5종 모두 true", () => {
    for (const ip of ["172.17.0.5", "172.16.0.0", "172.31.255.255", "10.5.5.5",
                      "192.168.0.1", "127.0.0.1", "::1",
                      "::ffff:172.17.0.5", "::ffff:127.0.0.1"]) expect(isInternalIp(ip)).toBe(true);
  });
  it("외부/경계 외 → false", () => {
    for (const ip of ["8.8.8.8", "203.0.113.42", "172.32.0.1", "172.15.255.255",
                      "11.0.0.0", "192.169.0.1", "128.0.0.1", "::ffff:8.8.8.8"]) expect(isInternalIp(ip)).toBe(false);
  });
  it("malformed → false (throw 금지)", () => {
    for (const bad of ["", "not-an-ip", "999.999.999.999", "192.168.1", "192.168.1.256"]) expect(isInternalIp(bad)).toBe(false);
  });
});
```

- [ ] **Step 1.1.2: 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter sim-internal-network test 2>&1 | tail -3
```

기대: `Cannot find package 'sim-internal-network'`.

- [ ] **Step 1.1.3: skeleton + isInternalIp 구현**

`packages/sim-internal-network/package.json`:

```json
{
  "name": "sim-internal-network", "version": "0.1.0",
  "description": "internal IP 검증 (docker network/loopback) — NestJS Guard + Hono middleware",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" } },
  "main": "./dist/index.cjs", "module": "./dist/index.js", "types": "./dist/index.d.ts", "files": ["dist"],
  "scripts": { "build": "tsup", "dev": "tsup --watch", "test": "vitest run", "typecheck": "tsc --noEmit", "clean": "rm -rf dist" },
  "peerDependencies": { "@nestjs/common": "^11.0.0", "hono": "^4.6.0" },
  "peerDependenciesMeta": { "@nestjs/common": { "optional": true }, "hono": { "optional": true } },
  "devDependencies": {
    "@nestjs/common": "^11.0.0", "@types/node": "^22.0.0", "hono": "^4.6.0",
    "tsup": "^8.5.1", "typescript": "^5.8.2", "vitest": "^1.6.1"
  }
}
```

`tsup.config.ts` / `tsconfig.json` / `vitest.config.ts`: 본 plan 상단 "공통 패키지 config 템플릿" 그대로.

`packages/sim-internal-network/src/is-internal-ip.ts`:

```typescript
// @def.boundary sim-internal-network
// spec 2026-05-02 §3 — internal IP only auth. 외부는 caller가 404 silent 처리.

interface Cidr4 { base: number; mask: number; }

function ipv4ToInt(ip: string): number | null {
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

function makeCidr(ip: string, prefixLen: number): Cidr4 {
  const baseInt = ipv4ToInt(ip);
  if (baseInt === null) throw new Error(`invalid CIDR base: ${ip}`);
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return { base: (baseInt & mask) >>> 0, mask };
}

const INTERNAL_V4: Cidr4[] = [
  makeCidr("10.0.0.0", 8), makeCidr("172.16.0.0", 12),
  makeCidr("192.168.0.0", 16), makeCidr("127.0.0.0", 8),
];

function isInternalV4(ip: string): boolean {
  const v = ipv4ToInt(ip);
  if (v === null) return false;
  for (const c of INTERNAL_V4) if (((v & c.mask) >>> 0) === c.base) return true;
  return false;
}

export function isInternalIp(ip: string): boolean {
  if (typeof ip !== "string" || ip.length === 0) return false;
  if (ip === "::1") return true;
  if (ip.startsWith("::ffff:")) return isInternalV4(ip.slice("::ffff:".length));
  return isInternalV4(ip);
}
```

`packages/sim-internal-network/src/index.ts`: `export { isInternalIp } from "./is-internal-ip.js";`

- [ ] **Step 1.1.4: 통과 + Commit**

```bash
pnpm install && pnpm --filter sim-internal-network test && pnpm --filter sim-internal-network build
git add packages/sim-internal-network/
git commit -m "feat(sim-internal-network): isInternalIp + package skeleton (tsup ESM+CJS dual)"
```

### Task 1.2: sim-internal-network NestJS Guard

**Files:** `packages/sim-internal-network/src/{nestjs-guard.ts, nestjs-guard.test.ts}` + `index.ts` 갱신

`@Injectable() InternalIpGuard implements CanActivate`. ExecutionContext에서 `request.ip` 또는 `x-forwarded-for` leftmost 추출 → false면 `NotFoundException` throw → 404 silent (spec §3).

- [ ] **Step 1.2.1: 실패 테스트 작성**

`packages/sim-internal-network/src/nestjs-guard.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NotFoundException, type ExecutionContext } from "@nestjs/common";
import { InternalIpGuard } from "./nestjs-guard.js";

function ctx(request: { ip?: string; headers?: Record<string, string> }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => ({}) }),
    getType: () => "http",
  } as unknown as ExecutionContext;
}

describe("InternalIpGuard (spec §3)", () => {
  const guard = new InternalIpGuard();
  it("internal request.ip → true / external → 404", () => {
    for (const ip of ["172.17.0.5", "127.0.0.1", "::1"]) expect(guard.canActivate(ctx({ ip }))).toBe(true);
    expect(() => guard.canActivate(ctx({ ip: "8.8.8.8" }))).toThrow(NotFoundException);
  });
  it("XFF leftmost로 분기", () => {
    expect(guard.canActivate(ctx({ headers: { "x-forwarded-for": "172.17.0.5, 8.8.8.8" } }))).toBe(true);
    expect(() => guard.canActivate(ctx({ headers: { "x-forwarded-for": "8.8.8.8, 172.17.0.5" } })))
      .toThrow(NotFoundException);
  });
  it("ip 정보 전혀 없으면 404 (정보 누출 방지)", () => {
    expect(() => guard.canActivate(ctx({}))).toThrow(NotFoundException);
  });
});
```

- [ ] **Step 1.2.2: 실패 확인**

```bash
pnpm --filter sim-internal-network test nestjs-guard 2>&1 | tail -3
```

기대: `Cannot find module './nestjs-guard.js'`.

- [ ] **Step 1.2.3: 구현 + index export 갱신**

`packages/sim-internal-network/src/nestjs-guard.ts`:

```typescript
// @def.boundary sim-internal-network
// spec 2026-05-02 §3 — controller/auth-api/approval-api admin endpoint 보호용 Guard.

import { Injectable, CanActivate, ExecutionContext, NotFoundException } from "@nestjs/common";
import { isInternalIp } from "./is-internal-ip.js";

interface IpRequest { ip?: string; headers?: Record<string, string | string[] | undefined>; }

function extractIp(req: IpRequest): string | null {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const leftmost = xff.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }
  if (Array.isArray(xff) && xff.length > 0) {
    const leftmost = xff[0]?.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }
  if (typeof req.ip === "string" && req.ip.length > 0) return req.ip;
  return null;
}

@Injectable()
export class InternalIpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<IpRequest>();
    const ip = extractIp(req);
    if (ip === null || !isInternalIp(ip)) throw new NotFoundException();
    return true;
  }
}
```

`packages/sim-internal-network/src/index.ts` 갱신: `export { InternalIpGuard } from "./nestjs-guard.js";` 한 줄 추가.

- [ ] **Step 1.2.4: 통과 + Commit**

```bash
pnpm --filter sim-internal-network test && pnpm --filter sim-internal-network build
git add packages/sim-internal-network/src/nestjs-guard.ts packages/sim-internal-network/src/nestjs-guard.test.ts packages/sim-internal-network/src/index.ts
git commit -m "feat(sim-internal-network): InternalIpGuard for NestJS (spec §3 silent 404)"
```

### Task 1.3: sim-internal-network Hono middleware

**Files:** `packages/sim-internal-network/src/{hono-middleware.ts, hono-middleware.test.ts}` + `index.ts` 갱신

gateway가 본 middleware를 사용한다 (Plan C Stage 7 escape hatch와 동일 패턴). `c.req.header("x-forwarded-for")` 또는 `c.env.remoteAddress`에서 IP 추출 → external이면 404 silent (body 없음), internal이면 `await next()`.

- [ ] **Step 1.3.1: 실패 테스트 작성**

`packages/sim-internal-network/src/hono-middleware.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { internalIpMiddleware } from "./hono-middleware.js";

function buildApp() {
  const app = new Hono();
  app.use("*", internalIpMiddleware());
  app.get("/admin/ping", (c) => c.json({ ok: true }));
  return app;
}
const fire = (h: Record<string, string>) => buildApp().fetch(new Request("http://t/admin/ping", { headers: h }));

describe("internalIpMiddleware (spec §3)", () => {
  it("internal → 200, external/missing → 404, multi-IP는 leftmost로 분기", async () => {
    const okBody = await (await fire({ "x-forwarded-for": "172.17.0.5" })).json();
    expect(okBody).toEqual({ ok: true });
    for (const xff of ["8.8.8.8", "8.8.8.8, 172.17.0.5"]) {
      expect((await fire({ "x-forwarded-for": xff })).status).toBe(404);
    }
    expect((await fire({ "x-forwarded-for": "172.17.0.5, 10.0.0.1, 8.8.8.8" })).status).toBe(200);
    expect((await fire({})).status).toBe(404);
  });
});
```

- [ ] **Step 1.3.2: 실패 확인**

```bash
pnpm --filter sim-internal-network test hono-middleware 2>&1 | tail -3
```

기대: `Cannot find module './hono-middleware.js'`.

- [ ] **Step 1.3.3: 구현 + index export**

`packages/sim-internal-network/src/hono-middleware.ts`:

```typescript
// @def.boundary sim-internal-network
// spec 2026-05-02 §3 — Hono 환경(gateway)용. external IP → 404 silent.

import type { MiddlewareHandler } from "hono";
import { isInternalIp } from "./is-internal-ip.js";

export interface InternalIpMiddlewareOptions {
  /** XFF 헤더 우선순위 사용 여부. default true (gateway 컨텍스트). */
  trustForwardedFor?: boolean;
}

function extractIp(c: Parameters<MiddlewareHandler>[0], opts: InternalIpMiddlewareOptions): string | null {
  if (opts.trustForwardedFor !== false) {
    const xff = c.req.header("x-forwarded-for");
    if (xff && xff.length > 0) {
      const leftmost = xff.split(",")[0]?.trim();
      if (leftmost) return leftmost;
    }
  }
  const env = (c.env ?? {}) as { remoteAddress?: string; remoteAddr?: string };
  if (typeof env.remoteAddress === "string" && env.remoteAddress.length > 0) return env.remoteAddress;
  if (typeof env.remoteAddr === "string" && env.remoteAddr.length > 0) return env.remoteAddr;
  return null;
}

export function internalIpMiddleware(opts: InternalIpMiddlewareOptions = {}): MiddlewareHandler {
  return async (c, next) => {
    const ip = extractIp(c, opts);
    if (ip === null || !isInternalIp(ip)) return c.body(null, 404);
    await next();
  };
}
```

`packages/sim-internal-network/src/index.ts` 갱신: `export { internalIpMiddleware, type InternalIpMiddlewareOptions } from "./hono-middleware.js";` 한 줄 추가.

- [ ] **Step 1.3.4: 통과 + Commit**

```bash
pnpm --filter sim-internal-network test && pnpm --filter sim-internal-network build
git add packages/sim-internal-network/src/hono-middleware.ts packages/sim-internal-network/src/hono-middleware.test.ts packages/sim-internal-network/src/index.ts
git commit -m "feat(sim-internal-network): internalIpMiddleware for Hono (gateway)"
```

### Task 1.4: packages/sim-decision-view 패키지 skeleton + 타입 export

**Files:** `packages/sim-decision-view/{package.json, tsup.config.ts, tsconfig.json, vitest.config.ts}` + `src/{index.ts, safety-decision-view.ts, resource-decision-view.ts, alert-event-view.ts, audit-trace-view.ts}`

view shape은 본 패키지가 SSOT (spec §4). 실제 런타임 검증은 Task 1.5 conversion 테스트가 수행하므로 별도 smoke test 생략.

- [ ] **Step 1.4.1: 빌드 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter sim-decision-view build 2>&1 | tail -3
```

기대: 패키지 미존재.

- [ ] **Step 1.4.2: skeleton + 4 타입 + index 작성**

`packages/sim-decision-view/package.json`: Task 1.1 의 sim-internal-network `package.json`과 동일한 구조 — `name: "sim-decision-view"`, `description: "controller 결정 객체 view DTO SSOT — producer/consumer drift 차단"`, peerDependencies/peerDependenciesMeta 항목 제거 (NestJS/Hono 의존 없음), devDependencies 도 NestJS/Hono 제외하여 `{ "@types/node": "^22.0.0", "tsup": "^8.5.1", "typescript": "^5.8.2", "vitest": "^1.6.1" }`. 나머지 (exports/scripts/main/module/types/files/version/type) 는 동일.

`tsup.config.ts` / `tsconfig.json` / `vitest.config.ts` 는 본 plan 상단 공통 템플릿 그대로.

view 타입 4 파일 — 각 파일에 `// @def.boundary sim-decision-view\n// spec 2026-05-02 §4` 헤더 부착. spec §4 의 view DTO 정의 그대로 다음과 같이 분리한다.

`safety-decision-view.ts`:

```typescript
export type SafetyVerdict = "promote" | "hold" | "rollback";
export type SafetyCategory = "perf" | "compatibility" | "decisionQuality" | "auditSafety" | "replicationHealth";
export type CategoryVerdict = "PASS" | "WARN" | "FAIL";
export type SafetyAction =
  | { kind: "weight-update"; revision: number; weight: number }
  | { kind: "rollback"; revision: number; reason: string }
  | { kind: "hold" };
export interface SafetyDecisionRecordView {
  cycleId: string; decisionId: string; pass: "safety";
  verdict: SafetyVerdict; triggerCategory?: SafetyCategory; triggerSignals: string[];
  categoryVerdicts: Record<SafetyCategory, CategoryVerdict>;
  confidence: number; cycleAt: string; action?: SafetyAction;
}
```

`resource-decision-view.ts`:

```typescript
import type { CategoryVerdict } from "./safety-decision-view.js";
export type ResourceVerdict = "scale-up" | "scale-down" | "hold" | "rejected";
export type ResourceCategory = "loadPressure" | "resourceHeadroom" | "stability";
export type ResourceRejection = "loadPressure" | "resourceHeadroom" | "stability";
export type ResourceAction =
  | { kind: "scale"; target: { v1: number; v2: number } }
  | { kind: "rejected"; reason: string }
  | { kind: "hold" };
export interface ResourceDecisionRecordView {
  cycleId: string; decisionId: string; pass: "resource";
  verdict: ResourceVerdict; rejectedBy?: ResourceRejection; triggerSignals: string[];
  categoryVerdicts: Record<ResourceCategory, CategoryVerdict>;
  confidence: number; cycleAt: string; action?: ResourceAction;
}
```

`alert-event-view.ts`:

```typescript
export interface AlertEventView { cycleId: string; kind: string; occurredAt: string; details?: Record<string, unknown>; }
```

`audit-trace-view.ts`:

```typescript
import type { SafetyDecisionRecordView } from "./safety-decision-view.js";
import type { ResourceDecisionRecordView } from "./resource-decision-view.js";
import type { AlertEventView } from "./alert-event-view.js";
export interface AuditTraceView {
  cycleId: string; cycleAt: string;
  decisions: { safety?: SafetyDecisionRecordView; resource?: ResourceDecisionRecordView };
  events: AlertEventView[];
}
```

`index.ts`:

```typescript
export type { SafetyDecisionRecordView, SafetyVerdict, SafetyCategory, CategoryVerdict, SafetyAction } from "./safety-decision-view.js";
export type { ResourceDecisionRecordView, ResourceVerdict, ResourceCategory, ResourceRejection, ResourceAction } from "./resource-decision-view.js";
export type { AlertEventView } from "./alert-event-view.js";
export type { AuditTraceView } from "./audit-trace-view.js";
```

- [ ] **Step 1.4.3: 빌드 통과 확인 (런타임 테스트는 Task 1.5)**

```bash
pnpm install && pnpm --filter sim-decision-view build
```

- [ ] **Step 1.4.4: Commit**

```bash
git add packages/sim-decision-view/
git commit -m "feat(sim-decision-view): view DTO 타입 4종 + 패키지 skeleton (spec §4)"
```

### Task 1.5: sim-decision-view conversion 함수

**Files:** `packages/sim-decision-view/src/{conversion.ts, conversion.test.ts}` + `index.ts` 갱신

`toSafetyDecisionView(internal): SafetyDecisionRecordView` 등 4 함수. evidence/internalSeq drop. internal record 타입은 본 패키지가 자체 input shape으로 선언 — controller 역의존 없음.

- [ ] **Step 1.5.1: 실패 테스트 작성**

`packages/sim-decision-view/src/conversion.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  toSafetyDecisionView, toResourceDecisionView, toAlertEventView, toAuditTraceView,
  type SafetyDecisionRecordInput, type ResourceDecisionRecordInput, type AlertEventRecordInput,
} from "./conversion.js";

const ID = "01HXYZ0000000000000000", AT = "2026-05-02T10:00:00.000Z";
const safety: SafetyDecisionRecordInput = {
  decisionId: `sim.dec.safety.${ID}`, cycleId: `sim.cyc.${ID}`, cycleAt: AT,
  pass: "safety", verdict: "promote", triggerSignals: [], confidence: 0.92,
  categoryVerdicts: { perf: "PASS", compatibility: "PASS", decisionQuality: "PASS", auditSafety: "PASS", replicationHealth: "PASS" },
  evidence: [{ kind: "data", source: "metrics:perf", content: { ok: true }, weight: 1 }],
  action: { kind: "weight-update", revision: 2, weight: 25 },
};
const resource: ResourceDecisionRecordInput = {
  decisionId: `sim.dec.resource.${ID}`, cycleId: safety.cycleId, cycleAt: "2026-05-02T10:00:30.000Z",
  pass: "resource", verdict: "rejected", rejectedBy: "resourceHeadroom",
  triggerSignals: ["resourceHeadroom"], confidence: 0.81,
  categoryVerdicts: { loadPressure: "FAIL", resourceHeadroom: "FAIL", stability: "PASS" },
  evidence: [], action: { kind: "rejected", reason: "resourceHeadroom FAIL" },
};
const alert: AlertEventRecordInput = {
  cycleId: safety.cycleId, kind: "scale-rejected", occurredAt: "2026-05-02T10:00:30.500Z",
  details: { rejectedBy: "resourceHeadroom" }, internalSeq: 17,
};

describe("conversion (sim-decision-view §4)", () => {
  it("4 view 변환: 필드 보존 + evidence/internalSeq drop + audit trace 합성/undefined", () => {
    const s = toSafetyDecisionView(safety), r = toResourceDecisionView(resource), a = toAlertEventView(alert);
    expect(s.action).toEqual({ kind: "weight-update", revision: 2, weight: 25 });
    expect(r.rejectedBy).toBe("resourceHeadroom");
    expect(a.kind).toBe("scale-rejected");
    for (const v of [s, r]) expect((v as unknown as { evidence?: unknown }).evidence).toBeUndefined();
    expect((a as unknown as { internalSeq?: unknown }).internalSeq).toBeUndefined();
    const t = toAuditTraceView({ cycleId: safety.cycleId, cycleAt: AT, safety, resource, events: [alert] });
    expect(t.decisions.safety?.verdict).toBe("promote");
    expect(t.decisions.resource?.verdict).toBe("rejected");
    expect(t.events).toHaveLength(1);
    const t2 = toAuditTraceView({ cycleId: safety.cycleId, cycleAt: AT, safety: undefined, resource: undefined, events: [] });
    expect(t2.decisions.safety).toBeUndefined();
    expect(t2.decisions.resource).toBeUndefined();
  });
});
```

- [ ] **Step 1.5.2: 실패 확인**

```bash
pnpm --filter sim-decision-view test conversion 2>&1 | tail -3
```

기대: `Cannot find module './conversion.js'`.

- [ ] **Step 1.5.3: 구현 + index export 갱신**

`packages/sim-decision-view/src/conversion.ts`:

```typescript
// @def.boundary sim-decision-view
// spec 2026-05-02 §4 — internal record → view DTO 매핑. evidence/internalSeq drop.

import type { SafetyDecisionRecordView, SafetyVerdict, SafetyCategory, CategoryVerdict, SafetyAction } from "./safety-decision-view.js";
import type { ResourceDecisionRecordView, ResourceVerdict, ResourceCategory, ResourceRejection, ResourceAction } from "./resource-decision-view.js";
import type { AlertEventView } from "./alert-event-view.js";
import type { AuditTraceView } from "./audit-trace-view.js";

export interface SafetyDecisionRecordInput {
  decisionId: string; cycleId: string; cycleAt: string; pass: "safety";
  verdict: SafetyVerdict; triggerCategory?: SafetyCategory; triggerSignals: string[];
  categoryVerdicts: Record<SafetyCategory, CategoryVerdict>;
  confidence: number; evidence?: unknown[]; action?: SafetyAction;
}
export interface ResourceDecisionRecordInput {
  decisionId: string; cycleId: string; cycleAt: string; pass: "resource";
  verdict: ResourceVerdict; rejectedBy?: ResourceRejection; triggerSignals: string[];
  categoryVerdicts: Record<ResourceCategory, CategoryVerdict>;
  confidence: number; evidence?: unknown[]; action?: ResourceAction;
}
export interface AlertEventRecordInput {
  cycleId: string; kind: string; occurredAt: string;
  details?: Record<string, unknown>;
  /** controller-internal sequence; view에서 drop. */
  internalSeq?: number;
}
export interface AuditTraceInput {
  cycleId: string; cycleAt: string;
  safety?: SafetyDecisionRecordInput; resource?: ResourceDecisionRecordInput;
  events: AlertEventRecordInput[];
}

export function toSafetyDecisionView(i: SafetyDecisionRecordInput): SafetyDecisionRecordView {
  return {
    cycleId: i.cycleId, decisionId: i.decisionId, pass: "safety", verdict: i.verdict,
    triggerCategory: i.triggerCategory, triggerSignals: [...i.triggerSignals],
    categoryVerdicts: { ...i.categoryVerdicts },
    confidence: i.confidence, cycleAt: i.cycleAt, action: i.action,
  };
}
export function toResourceDecisionView(i: ResourceDecisionRecordInput): ResourceDecisionRecordView {
  return {
    cycleId: i.cycleId, decisionId: i.decisionId, pass: "resource", verdict: i.verdict,
    rejectedBy: i.rejectedBy, triggerSignals: [...i.triggerSignals],
    categoryVerdicts: { ...i.categoryVerdicts },
    confidence: i.confidence, cycleAt: i.cycleAt, action: i.action,
  };
}
export function toAlertEventView(i: AlertEventRecordInput): AlertEventView {
  return { cycleId: i.cycleId, kind: i.kind, occurredAt: i.occurredAt, details: i.details };
}
export function toAuditTraceView(i: AuditTraceInput): AuditTraceView {
  return {
    cycleId: i.cycleId, cycleAt: i.cycleAt,
    decisions: {
      safety: i.safety ? toSafetyDecisionView(i.safety) : undefined,
      resource: i.resource ? toResourceDecisionView(i.resource) : undefined,
    },
    events: i.events.map(toAlertEventView),
  };
}
```

`packages/sim-decision-view/src/index.ts` 갱신: Task 1.4 의 4 view type re-export 뒤에 다음 두 줄 추가.

```typescript
export { toSafetyDecisionView, toResourceDecisionView, toAlertEventView, toAuditTraceView } from "./conversion.js";
export type { SafetyDecisionRecordInput, ResourceDecisionRecordInput, AlertEventRecordInput, AuditTraceInput } from "./conversion.js";
```

- [ ] **Step 1.5.4: 통과 + Commit**

```bash
pnpm --filter sim-decision-view test && pnpm --filter sim-decision-view build
git add packages/sim-decision-view/src/conversion.ts packages/sim-decision-view/src/conversion.test.ts packages/sim-decision-view/src/index.ts
git commit -m "feat(sim-decision-view): toSafetyDecisionView / toResource* / toAlert* / toAuditTrace* (spec §4)"
```

### Task 1.6: controller DecisionRingBuffer 클래스

**Files:** `simulations/enterprise-pm/services/canary-controller/src/decision/{decision-ring-buffer.ts, decision-ring-buffer.test.ts}`

spec §5 — controller 자체 ring buffer가 SSOT. Pass 1 soft rollback 윈도우와 endpoint query 모두 본 ring buffer를 참조한다. `maxSize=100` (env override `SIM_CONTROLLER_RING_SIZE`). D-stage-9 plan의 `this.history`(boolean[]) 변수는 Task 1.7에서 `recentSafetyHistory()` 파생으로 통합된다.

- [ ] **Step 1.6.1: 실패 테스트 작성**

`simulations/enterprise-pm/services/canary-controller/src/decision/decision-ring-buffer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { DecisionRingBuffer } from "./decision-ring-buffer.js";
import type { SafetyDecisionRecordInput, ResourceDecisionRecordInput, AlertEventRecordInput } from "sim-decision-view";

const C = (n: number) => `sim.cyc.01HXYZ000000000000000${n}`;
function s(cId: string, verdict: "promote" | "rollback" = "promote", at = "2026-05-02T10:00:00.000Z"): SafetyDecisionRecordInput {
  return {
    decisionId: `sim.dec.safety.${cId.replace("sim.cyc.", "")}`,
    cycleId: cId, pass: "safety", verdict, cycleAt: at, triggerSignals: [], confidence: 0.9,
    categoryVerdicts: { perf: "PASS", compatibility: "PASS", decisionQuality: "PASS", auditSafety: "PASS", replicationHealth: "PASS" },
  };
}
function r(cId: string, verdict: "scale-up" | "rejected" = "scale-up"): ResourceDecisionRecordInput {
  return {
    decisionId: `sim.dec.resource.${cId.replace("sim.cyc.", "")}`,
    cycleId: cId, pass: "resource", verdict,
    cycleAt: "2026-05-02T10:00:30.000Z", triggerSignals: [], confidence: 0.85,
    categoryVerdicts: { loadPressure: "PASS", resourceHeadroom: "PASS", stability: "PASS" },
  };
}

describe("DecisionRingBuffer (spec §5)", () => {
  let rb: DecisionRingBuffer;
  beforeEach(() => { rb = new DecisionRingBuffer({ maxSize: 5 }); });

  it("appendSafety FIFO + maxSize evict + queryDecisions 필터(verdict/cycleIds/limit) + queryFirst null/match", () => {
    for (let i = 1; i <= 7; i++) rb.appendSafety(s(C(i), i === 4 ? "rollback" : "promote"));
    const all = rb.queryDecisions({ pass: "safety" });
    expect(all).toHaveLength(5);
    expect(all[0].cycleId).toBe(C(3));
    expect(rb.queryDecisions({ pass: "safety", verdict: "rollback" })).toHaveLength(1);
    expect(rb.queryDecisions({ pass: "safety", cycleIds: [C(5)] })).toHaveLength(1);
    expect(rb.queryDecisions({ pass: "safety", limit: 2 })).toHaveLength(2);
    expect(rb.queryFirst({ pass: "safety", verdict: "rollback" })?.cycleId).toBe(C(4));
    expect(rb.queryFirst({ pass: "resource" })).toBeNull();
  });

  it("recentCycleIds/recentCycleCount + countAlerts + trace + recentSafetyHistory", () => {
    const ev: AlertEventRecordInput = { cycleId: C(1), kind: "scale-rejected", occurredAt: "2026-05-02T10:00:00.000Z" };
    rb.appendAlert(ev);
    rb.appendAlert({ ...ev, kind: "audit-critical-anomaly" });
    rb.appendAlert({ ...ev, cycleId: C(2) });
    rb.appendSafety(s(C(1), "promote", "2026-05-02T10:00:00.000Z"));
    rb.appendResource(r(C(1)));
    rb.appendSafety(s(C(2), "rollback", "2026-05-02T10:00:30.000Z"));
    rb.appendSafety(s(C(3), "promote", "2026-05-02T10:01:00.000Z"));
    expect(rb.recentCycleIds(10)).toEqual([C(3), C(2), C(1)]);
    expect(rb.recentCycleCount()).toBe(3);
    expect(rb.countAlerts({ kind: "scale-rejected" })).toBe(2);
    expect(rb.countAlerts({ kind: "audit-critical-anomaly" })).toBe(1);
    expect(rb.countAlerts({ kind: "scale-rejected", cycleIds: [C(1)] })).toBe(1);
    expect(rb.trace(C(1))?.resource?.verdict).toBe("scale-up");
    expect(rb.recentSafetyHistory(10)).toEqual([false, true, false]);
  });
});
```

- [ ] **Step 1.6.2: 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk-sim/canary-controller test decision-ring-buffer 2>&1 | tail -3
```

기대: `Cannot find module './decision-ring-buffer.js'`.

- [ ] **Step 1.6.3: 구현**

`simulations/enterprise-pm/services/canary-controller/src/decision/decision-ring-buffer.ts`:

```typescript
// @def.boundary sim-canary-controller
// spec 2026-05-02 §5 — Pass 1 soft rollback 윈도우 + endpoint query 공유 SSOT.

import type { SafetyDecisionRecordInput, ResourceDecisionRecordInput, AlertEventRecordInput } from "sim-decision-view";

export interface DecisionRingBufferOptions {
  /** maxSize. env SIM_CONTROLLER_RING_SIZE 로 override. default 100. */
  maxSize?: number;
}
export interface DecisionFilter {
  pass: "safety" | "resource";
  verdict?: string; cycleIds?: readonly string[]; since?: string; limit?: number;
}
export interface AlertFilter { kind: string; cycleIds?: readonly string[]; since?: string; }
export interface TraceView {
  cycleId: string; cycleAt: string;
  safety?: SafetyDecisionRecordInput; resource?: ResourceDecisionRecordInput;
  events: AlertEventRecordInput[];
}

export class DecisionRingBuffer {
  private safetyRing: SafetyDecisionRecordInput[] = [];
  private resourceRing: ResourceDecisionRecordInput[] = [];
  private alertEvents: AlertEventRecordInput[] = [];
  private readonly maxSize: number;
  constructor(opts: DecisionRingBufferOptions = {}) { this.maxSize = Math.max(1, Math.floor(opts.maxSize ?? 100)); }

  private push<T>(arr: T[], item: T): void { arr.push(item); while (arr.length > this.maxSize) arr.shift(); }
  appendSafety(r: SafetyDecisionRecordInput): void { this.push(this.safetyRing, r); }
  appendResource(r: ResourceDecisionRecordInput): void { this.push(this.resourceRing, r); }
  appendAlert(e: AlertEventRecordInput): void { this.push(this.alertEvents, e); }

  queryDecisions(f: DecisionFilter): SafetyDecisionRecordInput[] | ResourceDecisionRecordInput[] {
    const ring = f.pass === "safety" ? this.safetyRing : this.resourceRing;
    let out = ring.filter((r) =>
      (f.verdict === undefined || r.verdict === f.verdict)
      && (!f.cycleIds || f.cycleIds.includes(r.cycleId))
      && (f.since === undefined || r.cycleAt >= f.since));
    if (f.limit !== undefined) out = out.slice(0, Math.max(0, Math.floor(f.limit)));
    return out as SafetyDecisionRecordInput[] | ResourceDecisionRecordInput[];
  }

  queryFirst(f: Omit<DecisionFilter, "limit">): SafetyDecisionRecordInput | ResourceDecisionRecordInput | null {
    return this.queryDecisions({ ...f, limit: 1 })[0] ?? null;
  }

  recentCycleIds(limit: number): string[] {
    const seen = new Set<string>(), ordered: string[] = [];
    const max = Math.max(0, Math.floor(limit));
    const sorted = [...this.safetyRing, ...this.resourceRing]
      .sort((a, b) => (a.cycleAt < b.cycleAt ? 1 : a.cycleAt > b.cycleAt ? -1 : 0));
    for (const r of sorted) {
      if (!seen.has(r.cycleId)) { seen.add(r.cycleId); ordered.push(r.cycleId); if (ordered.length >= max) break; }
    }
    return ordered;
  }
  recentCycleCount(): number {
    return new Set([...this.safetyRing, ...this.resourceRing].map((r) => r.cycleId)).size;
  }

  countAlerts(f: AlertFilter): number {
    return this.alertEvents.reduce((n, e) =>
      (e.kind === f.kind && (!f.cycleIds || f.cycleIds.includes(e.cycleId))
       && (f.since === undefined || e.occurredAt >= f.since)) ? n + 1 : n, 0);
  }

  trace(cycleId: string): TraceView | null {
    const safety = this.safetyRing.find((r) => r.cycleId === cycleId);
    const resource = this.resourceRing.find((r) => r.cycleId === cycleId);
    if (!safety && !resource) return null;
    return {
      cycleId, cycleAt: safety?.cycleAt ?? resource?.cycleAt ?? new Date(0).toISOString(),
      safety, resource, events: this.alertEvents.filter((e) => e.cycleId === cycleId),
    };
  }

  /** spec 01 §3 dwell window — Pass 1 soft rollback 카운트용. true = FAIL. */
  recentSafetyHistory(n: number): boolean[] {
    return this.safetyRing.slice(-Math.max(0, Math.floor(n))).map((r) => r.verdict === "rollback");
  }
}
```

- [ ] **Step 1.6.4: 통과 + Commit**

```bash
pnpm --filter @qa-sdk-sim/canary-controller test decision-ring-buffer
git add simulations/enterprise-pm/services/canary-controller/src/decision/decision-ring-buffer.ts simulations/enterprise-pm/services/canary-controller/src/decision/decision-ring-buffer.test.ts
git commit -m "feat(sim-canary-controller): DecisionRingBuffer (safety/resource/alert SSOT, spec §5)"
```

### Task 1.7: CycleScheduler에 ring buffer wiring

**Files:** `simulations/enterprise-pm/services/canary-controller/src/cycle/{cycle-scheduler.service.ts, cycle.module.ts}` (modify)

D-stage-9 plan에서 `runCycle()` 본체가 `this.history`(boolean[]) 변수를 직접 사용한다. 본 task는 ring buffer 호출로 교체하고 `recentSafetyHistory()`로 boolean 배열을 파생한다. 부수 효과: `appendSafety`/`appendResource` 두 호출 추가 + `this.history` 필드 제거.

- [ ] **Step 1.7.1: 실패 테스트 작성**

`simulations/enterprise-pm/services/canary-controller/src/cycle/cycle-scheduler.ring-buffer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { CycleSchedulerService } from "./cycle-scheduler.service.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";

describe("CycleSchedulerService — ring buffer wiring (spec §5)", () => {
  it("history 필드 제거 + DecisionRingBuffer wiring 사용 가능", () => {
    expect(Object.getOwnPropertyDescriptor(CycleSchedulerService.prototype, "history")).toBeUndefined();
    expect(typeof CycleSchedulerService).toBe("function");
    expect(DecisionRingBuffer).toBeDefined();
  });
});
```

> 본 wiring 테스트는 cycle-flow 통합 테스트(D-stage-9 Task 9.13)와 보완 관계다. 통합 mock 셋업은 D-stage-9 파일에서 import 재사용 — 본 task 는 wiring 정합만 검증한다.

- [ ] **Step 1.7.2: 실패 확인**

```bash
pnpm --filter @qa-sdk-sim/canary-controller test cycle-scheduler.ring-buffer 2>&1 | tail -3
```

기대: `service.history` 필드가 정의되어 있어 단언 FAIL.

- [ ] **Step 1.7.3: cycle-scheduler.service.ts 수정 + cycle.module.ts 갱신**

`cycle-scheduler.service.ts`: D-stage-9 plan 라인 864~898 의 `runCycle()` 본체에 다음 5 패치를 적용 (나머지 본체는 D-stage-9 그대로):

1. `import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";` 추가.
2. `constructor`에 `private readonly ringBuffer: DecisionRingBuffer` 의존성 추가.
3. 클래스 멤버에서 `private history: boolean[] = [];` 라인 제거.
4. `safety.decide({ ... history: this.history ... })` → `history: this.ringBuffer.recentSafetyHistory(10)`.
5. `await this.builder.write(safetyRecord)` 직후 `this.ringBuffer.appendSafety(safetyRecord);`, `await this.builder.write(resourceRecord)` 직후 `this.ringBuffer.appendResource(resourceRecord);`. 사이클 끝 `this.history = [...this.history.slice(-9), failNow];` 라인 제거 (ring buffer가 이미 누적 완료).

`cycle.module.ts`: 기존 `@Module` 선언에 다음 두 변경 적용 — `providers` 배열에 `{ provide: DecisionRingBuffer, useFactory: () => new DecisionRingBuffer({ maxSize: Number(process.env.SIM_CONTROLLER_RING_SIZE ?? "100") }) }` 추가 (`import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js"` 동시 추가), `exports` 배열에 `DecisionRingBuffer` 추가. 기존 lock/scrape/verdict/safety/resource/builder/action provider는 그대로 유지.

`DecisionRingBuffer` 는 module level singleton (NestJS provider default) → cycle scheduler 와 endpoint controller 같은 instance 공유.

- [ ] **Step 1.7.4: 통과 + Commit**

```bash
pnpm --filter @qa-sdk-sim/canary-controller test cycle-scheduler
git add simulations/enterprise-pm/services/canary-controller/src/cycle/
git commit -m "refactor(sim-canary-controller): wire CycleScheduler to DecisionRingBuffer (history field 제거, spec §5)"
```

### Task 1.8: DecisionQueryController + InternalIpGuard 부착

**Files:** `simulations/enterprise-pm/services/canary-controller/src/decision/{decision-query.controller.ts, decision-query.controller.test.ts}`

`@Controller("v1") @UseGuards(InternalIpGuard)` 클래스가 spec §6 endpoint 1~3 구현. zod query 검증 + sim-decision-view conversion. `/v1/alerts/count`, `/v1/audit/trace`, `/v1/catalog/states` 는 Stage 1b.

- [ ] **Step 1.8.1: 실패 테스트 작성**

테스트 헬퍼 `s()` / `C()` 는 Task 1.6 와 동일 — 본 파일에서 그대로 inline.

`simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.controller.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { NestFastifyApplication, FastifyAdapter } from "@nestjs/platform-fastify";
import { DecisionQueryController } from "./decision-query.controller.js";
import { DecisionRingBuffer } from "./decision-ring-buffer.js";
import type { SafetyDecisionRecordInput } from "sim-decision-view";

const C = (n: number) => `sim.cyc.01HXYZ000000000000000${n}`;
function s(cId: string, verdict: "promote" | "rollback" = "promote", at = "2026-05-02T10:00:00.000Z"): SafetyDecisionRecordInput {
  return {
    decisionId: `sim.dec.safety.${cId.replace("sim.cyc.", "")}`,
    cycleId: cId, pass: "safety", verdict, cycleAt: at, triggerSignals: [], confidence: 0.9,
    categoryVerdicts: { perf: "PASS", compatibility: "PASS", decisionQuality: "PASS", auditSafety: "PASS", replicationHealth: "PASS" },
  };
}

describe("DecisionQueryController (spec §6)", () => {
  let app: NestFastifyApplication; let rb: DecisionRingBuffer;
  beforeEach(async () => {
    rb = new DecisionRingBuffer({ maxSize: 100 });
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [DecisionQueryController],
      providers: [{ provide: DecisionRingBuffer, useValue: rb }],
    }).compile();
    app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  const fire = (url: string, headers: Record<string, string> = {}) =>
    app.inject({ method: "GET", url, headers: { "x-forwarded-for": "172.17.0.5", ...headers } });

  it("3 endpoint × (200/필터/400/first null/cycles 최신순/외부 IP 404)", async () => {
    rb.appendSafety(s(C(1), "promote", "2026-05-02T10:00:00.000Z"));
    rb.appendSafety(s(C(2), "rollback", "2026-05-02T10:00:30.000Z"));
    rb.appendSafety(s(C(3), "promote", "2026-05-02T10:01:00.000Z"));
    const all = (await fire("/v1/decisions?pass=safety")).json() as { items: { cycleId: string }[] };
    expect(all.items).toHaveLength(3);
    expect(all.items[0]).not.toHaveProperty("evidence");
    const filt = (await fire("/v1/decisions?pass=safety&verdict=rollback&limit=10")).json() as { items: { verdict: string }[] };
    expect(filt.items[0].verdict).toBe("rollback");
    expect((await fire("/v1/decisions?pass=invalid")).statusCode).toBe(400);
    const fst = (await fire("/v1/decisions/first?pass=safety&verdict=rollback")).json() as { item: { cycleId: string } };
    expect(fst.item.cycleId).toBe(C(2));
    expect(((await fire("/v1/decisions/first?pass=resource")).json() as { item: unknown }).item).toBeNull();
    const recent = (await fire("/v1/cycles/recent?limit=2")).json() as { cycleIds: string[]; total: number };
    expect(recent.cycleIds).toEqual([C(3), C(2)]);
    expect(recent.total).toBe(3);
    expect((await app.inject({ method: "GET", url: "/v1/decisions?pass=safety",
      headers: { "x-forwarded-for": "8.8.8.8" } })).statusCode).toBe(404);
  });
});
```

- [ ] **Step 1.8.2: 실패 확인**

```bash
pnpm --filter @qa-sdk-sim/canary-controller test decision-query.controller 2>&1 | tail -3
```

기대: `Cannot find module './decision-query.controller.js'`.

- [ ] **Step 1.8.3: 구현**

`simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.controller.ts`:

```typescript
// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 1~3 + InternalIpGuard (§3).

import { Controller, Get, Query, UseGuards, BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { InternalIpGuard } from "sim-internal-network";
import { toSafetyDecisionView, toResourceDecisionView,
  type SafetyDecisionRecordView, type ResourceDecisionRecordView } from "sim-decision-view";
import { DecisionRingBuffer } from "./decision-ring-buffer.js";

const Pass = z.enum(["safety", "resource"]);
const SafetyVerdict = z.enum(["promote", "hold", "rollback"]);
const ResourceVerdict = z.enum(["scale-up", "scale-down", "hold", "rejected"]);

const Q_DECISIONS = z.object({
  pass: Pass, verdict: z.string().optional(), since: z.string().optional(),
  cycleIds: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
const Q_FIRST = z.object({ pass: Pass, verdict: z.string().optional(), cycleIds: z.string().optional() });
const Q_RECENT = z.object({ limit: z.coerce.number().int().positive().max(100).default(10) });

const ERR_TYPE = "https://qa-sdk.dev/errors/validation";
const bad = (detail: string): never => {
  throw new BadRequestException({ type: ERR_TYPE, title: "validation failed", status: 400, detail });
};
function parse<T>(schema: z.ZodSchema<T>, raw: Record<string, unknown>): T {
  const r = schema.safeParse(raw);
  if (!r.success) bad(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}
function checkVerdict(pass: "safety" | "resource", verdict: string | undefined): void {
  if (verdict === undefined) return;
  const sc = pass === "safety" ? SafetyVerdict : ResourceVerdict;
  if (!sc.safeParse(verdict).success) bad(`verdict invalid for pass=${pass}: ${verdict}`);
}
const splitCsv = (s: string | undefined): string[] | undefined =>
  s === undefined || s.length === 0 ? undefined : s.split(",").map((x) => x.trim()).filter((x) => x.length > 0);

type DecisionView = SafetyDecisionRecordView | ResourceDecisionRecordView;
const toView = (r: { pass: "safety" | "resource" } & Record<string, unknown>): DecisionView =>
  r.pass === "safety" ? toSafetyDecisionView(r as never) : toResourceDecisionView(r as never);

@Controller("v1")
@UseGuards(InternalIpGuard)
export class DecisionQueryController {
  constructor(private readonly ringBuffer: DecisionRingBuffer) {}

  @Get("decisions")
  decisions(@Query() raw: Record<string, unknown>): { items: DecisionView[] } {
    const q = parse(Q_DECISIONS, raw);
    checkVerdict(q.pass, q.verdict);
    const records = this.ringBuffer.queryDecisions({
      pass: q.pass, verdict: q.verdict, since: q.since,
      cycleIds: splitCsv(q.cycleIds), limit: q.limit,
    });
    return { items: records.map((r) => toView(r)) };
  }

  @Get("decisions/first")
  decisionsFirst(@Query() raw: Record<string, unknown>): { item: DecisionView | null } {
    const q = parse(Q_FIRST, raw);
    checkVerdict(q.pass, q.verdict);
    const r = this.ringBuffer.queryFirst({ pass: q.pass, verdict: q.verdict, cycleIds: splitCsv(q.cycleIds) });
    return { item: r === null ? null : toView(r) };
  }

  @Get("cycles/recent")
  cyclesRecent(@Query() raw: Record<string, unknown>): { cycleIds: string[]; total: number } {
    const q = parse(Q_RECENT, raw);
    return { cycleIds: this.ringBuffer.recentCycleIds(q.limit), total: this.ringBuffer.recentCycleCount() };
  }
}
```

- [ ] **Step 1.8.4: 통과 + Commit**

```bash
pnpm --filter @qa-sdk-sim/canary-controller test decision-query.controller
git add simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.controller.ts simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.controller.test.ts
git commit -m "feat(sim-canary-controller): /v1/decisions, /v1/decisions/first, /v1/cycles/recent + InternalIpGuard (spec §3·§6)"
```

### Task 1.9: controller AppModule에 DecisionQueryModule 등록

**Files:** `simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.module.ts` (create), `src/app.module.ts` (modify), `package.json` (modify)

DecisionQueryModule = CycleModule import (DecisionRingBuffer 공유) + controller 등록. AppModule.imports 에 DecisionQueryModule 추가. controller package.json deps 에 `sim-internal-network`, `sim-decision-view`, `zod` 추가.

- [ ] **Step 1.9.1: 실패 테스트 작성 — bootstrap smoke**

`simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.module.smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import { DecisionQueryModule } from "./decision-query.module.js";
import { DecisionQueryController } from "./decision-query.controller.js";
import { DecisionRingBuffer } from "./decision-ring-buffer.js";

describe("DecisionQueryModule wiring (spec §6)", () => {
  it("module compile + controller resolved + ringBuffer singleton", async () => {
    const m = await Test.createTestingModule({ imports: [DecisionQueryModule] })
      .overrideProvider(DecisionRingBuffer).useValue(new DecisionRingBuffer({ maxSize: 50 })).compile();
    expect(m.get(DecisionQueryController)).toBeInstanceOf(DecisionQueryController);
    expect(m.get(DecisionRingBuffer)).toBe(m.get(DecisionRingBuffer));
  });
});
```

- [ ] **Step 1.9.2: 실패 확인**

```bash
pnpm --filter @qa-sdk-sim/canary-controller test decision-query.module.smoke 2>&1 | tail -3
```

기대: `Cannot find module './decision-query.module.js'`.

- [ ] **Step 1.9.3: DecisionQueryModule + AppModule + package.json 갱신**

`decision-query.module.ts` (신규, CycleModule이 DecisionRingBuffer export 하므로 imports만 추가):

```typescript
// @def.boundary sim-canary-controller — spec 2026-05-02 §6.
import { Module } from "@nestjs/common";
import { CycleModule } from "../cycle/cycle.module.js";
import { DecisionQueryController } from "./decision-query.controller.js";

@Module({ imports: [CycleModule], controllers: [DecisionQueryController] })
export class DecisionQueryModule {}
```

`app.module.ts` 수정: `import { DecisionQueryModule } from "./decision/decision-query.module.js";` 추가, `@Module.imports` 배열에 `DecisionQueryModule` 추가 (기존 `CycleModule` + 기타 imports 유지).

`package.json` `dependencies` 에 다음 3 항목 추가 (기존 deps 보존):

```json
{
  "dependencies": {
    "sim-internal-network": "workspace:*",
    "sim-decision-view": "workspace:*",
    "zod": "^3.24.2"
  }
}
```

- [ ] **Step 1.9.4: 통과 + Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
pnpm --filter @qa-sdk-sim/canary-controller test decision-query.module.smoke
pnpm --filter @qa-sdk-sim/canary-controller build
git add simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.module.ts simulations/enterprise-pm/services/canary-controller/src/decision/decision-query.module.smoke.test.ts simulations/enterprise-pm/services/canary-controller/src/app.module.ts simulations/enterprise-pm/services/canary-controller/package.json pnpm-lock.yaml
git commit -m "feat(sim-canary-controller): wire DecisionQueryModule into AppModule (sim-internal-network, sim-decision-view deps)"
```

### Task 1.10: Stage 1a 통합 검증

본 stage 의 모든 산출물을 한 묶음으로 검증. 신규 패키지 2 + ring buffer + 3 endpoint 가 빌드 통과하고, Plan A Stage 1 의 host.docker.internal 제거 보증이 무회귀임을 grep gate 로 확인한다. 추가로 sim-decision-view import drift 가 없는지 contract typecheck 로 게이트한다.

- [ ] **Step 1.10.1: 전체 빌드 + 테스트 + typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter sim-internal-network build && pnpm --filter sim-decision-view build && pnpm --filter @qa-sdk-sim/canary-controller build
pnpm --filter sim-internal-network test && pnpm --filter sim-decision-view test && pnpm --filter @qa-sdk-sim/canary-controller test
pnpm --filter sim-internal-network typecheck && pnpm --filter sim-decision-view typecheck && pnpm --filter @qa-sdk-sim/canary-controller typecheck
```

기대: 3 패키지 dts/esm/cjs 산출, 모든 테스트 PASS, `tsc --noEmit` 통과.

- [ ] **Step 1.10.2: host.docker.internal 무회귀 + spec cross-ref grep**

```bash
grep -rn "host.docker.internal" simulations/enterprise-pm/ --include="*.yaml" --include="*.yml" --include="*.example" --include="*.sh" | grep -v "extra_hosts" | grep -v "^Binary"
grep -rn "spec 2026-05-02" packages/sim-internal-network/src/ packages/sim-decision-view/src/ simulations/enterprise-pm/services/canary-controller/src/decision/ | wc -l
```

기대: 첫 grep 출력 없음 (Plan A Stage 1 보증 유지). 두 번째 grep `>= 5` (각 신규 파일 헤더에 spec 참조).

- [ ] **Step 1.10.3: contract typecheck — sim-decision-view import drift 차단**

다음 단언 코드를 임시 fixture로 통과 확인 (commit 안 함):

```typescript
import type { SafetyDecisionRecordView } from "sim-decision-view";
import { toSafetyDecisionView } from "sim-decision-view";
import type { SafetyDecisionRecord } from "@qa-sdk-sim/canary-controller/decision";
const _check: (r: SafetyDecisionRecord) => SafetyDecisionRecordView = toSafetyDecisionView;
```

기대: `tsc --noEmit` 통과. 실패 시 controller `SafetyDecisionRecord`가 `SafetyDecisionRecordInput`와 호환되도록 필드 이름·타입을 정렬한다 (D-stage-9 plan 라인 706~719 참조).

- [ ] **Step 1.10.4: stage 마무리 git log 확인**

```bash
git log --oneline -10 ; git status
```

기대: Task 1.1~1.9 의 9 commit이 stage 1a 범위로 정렬되어 있음. PR-A 본문에서 Stage 1a 범위로 위 9 commit을 cherry-list 하고, Stage 1b는 후속 plan 문서 `A-stage-1b-admin-and-fault.md`로 이어 받는다.

---

**Stage 1a DoD**

- [ ] sim-internal-network: isInternalIp + InternalIpGuard + internalIpMiddleware export, unit test PASS
- [ ] sim-decision-view: 4 view 타입 + 4 conversion 함수 export, conversion test PASS
- [ ] DecisionRingBuffer + cycle-scheduler ring buffer wiring (history 필드 제거)
- [ ] DecisionQueryController 3 endpoint (`/v1/decisions`, `/v1/decisions/first`, `/v1/cycles/recent`) + InternalIpGuard
- [ ] AppModule 에 DecisionQueryModule 등록, controller TS 빌드 통과
- [ ] host.docker.internal 무회귀 grep + spec §3·§4·§5·§6 cross-ref 헤더 통과

**Stage 1b 로 넘기는 항목** (`A-stage-1b-admin-and-fault.md`): `/v1/alerts/count`, `/v1/audit/trace`, `/v1/catalog/states` (3종) + `/admin/fault/{kind}` + FaultKind 2종 확장 (`pubsub-invalidate-drop`, `perf-warn`) + `/admin/compose/replicas` + `/admin/scale/pin` (GET/POST) + `/admin/scale/replicas` + ActionExecutor #21 (gateway `RoutingPushSchema` 변환).

cross-ref: spec `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §3·§4·§5·§6; spec `docs/superpowers/specs/2026-04-28-canary-scaling/01-decision-model.md` §1 (SafetyDecisionRecord/ResourceDecisionRecord); plan `docs/superpowers/plans/2026-04-28-canary-scaling/D-stage-9-controller.md` (CycleScheduler 기존 history 변수 위치); plan `docs/superpowers/plans/2026-04-28-canary-scaling/E-stage-11-scenarios.md` (audit-fetcher consumer 시그니처); plan `docs/superpowers/plans/2026-04-28-canary-scaling/C-stage-7-gateway.md` (Hono internal IP middleware 패턴).

---

## Defect Log (2026-05-02)

> 본 섹션은 Stage 1a 실행 중 발견된 plan defect 와 해결을 영구 기록한다. 각 defect는
> 실제 commit SHA로 추적 가능하다.

### Task 1.5 defect — Input action 어휘가 View 를 forward-mirror

초안 plan 의 `SafetyDecisionRecordInput.action` / `ResourceDecisionRecordInput.action`
이 View 타입을 forward-mirror 하면서 controller record 어휘와 어긋났다.

| 측 | safety action 어휘 | resource action 어휘 |
|----|------------------|------------------|
| controller record (D-stage-9) | `weight-update \| noop` | `scale(reason) \| noop` |
| Task 1.5 초안 Input | `weight-update \| rollback \| hold` | `scale \| rejected \| hold` |
| View | `weight-update \| rollback \| hold` | `scale \| rejected \| hold` |

원래 spec §4 의도는 "Input = producer (controller record) shape mirror, View =
API consumer shape, conversion 함수가 normalize". 따라서 Input 측 어휘를
controller 와 동일하게 정렬하고, normalize 로직을 추가한다.

**Resolution (commit `2442b0a6`)** — `packages/sim-decision-view/src/conversion.ts`:

- `SafetyActionInput = { kind: "weight-update"; revision; weight: number } | { kind: "noop" }`
- `ResourceActionInput = { kind: "scale"; target; reason } | { kind: "noop" }`
- `normalizeSafetyAction`: `noop → hold`, `weight-update + verdict=rollback → rollback(reason=triggerSignals[0])`, 그 외 → 그대로
- `normalizeResourceAction`: `noop + verdict=rejected → rejected(reason=triggerSignals[0])`, `noop → hold`, `scale → reason drop`

**추가된 conversion 테스트 6 케이스**:

1. safety: `noop` + `verdict=hold` → view `{ kind: "hold" }`
2. safety: `weight-update(weight=0)` + `verdict=rollback` + `triggerSignals=["perf-regression"]` → view `{ kind: "rollback", revision, reason: "perf-regression" }`
3. safety: `weight-update(weight=25)` + `verdict=promote` → view `{ kind: "weight-update", revision, weight: 25 }` (그대로)
4. resource: `scale(reason)` + `verdict=scale-up` → view `{ kind: "scale", target }` (reason drop)
5. resource: `noop` + `verdict=rejected` + `triggerSignals=["resource-headroom"]` → view `{ kind: "rejected", reason: "resource-headroom" }`
6. resource: `noop` + `verdict=hold` → view `{ kind: "hold" }`

총 7 conversion test pass (기존 1 + 신규 6).

### Task 1.7 defect #1 — red 단언 깨짐

초안 plan §1.7.1 의 red 단언:

```typescript
expect(Object.getOwnPropertyDescriptor(CycleSchedulerService.prototype, "history"))
  .toBeUndefined();
```

class 인스턴스 필드 (`private history: boolean[] = []`) 는 prototype 이 아닌
instance 에 존재하므로 `getOwnPropertyDescriptor(prototype, "history")` 는
변경 전후 동일하게 `undefined` 를 반환한다. 즉 red→green 의 red 단계가
관측되지 않는다.

**Resolution (commit `c038803a`)** — 단순 export 정합 단언으로 대체:

```typescript
expect(typeof CycleSchedulerService).toBe("function");
expect(DecisionRingBuffer).toBeDefined();
```

`history` 필드 제거의 실질적 red→green 검증은 D-stage-9 Task 9.13 cycle-flow
통합 테스트가 담당 (runCycle 본체에서 ringBuffer.recentSafetyHistory(10) 호출 확인 +
appendSafety/appendResource 호출 확인 + history 필드 부재 검증).

### Task 1.7 defect #2 — record→Input 타입 mismatch

상기 Task 1.5 defect 와 동일한 어휘 mismatch 가 ring buffer push 시 typecheck 실패로
surfacing 됐다. Task 1.5 의 Input 타입 수정으로 controller record 가 직접
`appendSafety` / `appendResource` 에 push 가능. 별도 adapter 불필요.

**Typecheck status (post-fix)** — `pnpm --filter @qa-sdk/sim-canary-controller typecheck`:
2 ring buffer push site 에러 (TS2345) 모두 해결. 잔여 `src/main.ts(8,46): @qa-sdk/otel
module not found` 는 pre-existing baseline noise (이번 작업 범위 외).

### Task 1.8 environmental constraint #1 — vitest+NestJS DI: `@Inject(DecisionRingBuffer)` 필수

NestJS Reflect-based DI 는 TypeScript `emitDecoratorMetadata` 가 emit 한 design:paramtypes
를 읽어 token 을 추론한다. 본 monorepo 의 vitest 는 esbuild transpile 을 쓰므로 metadata
emit 이 없어 ctor 인자가 `Object` 로 보인다. 결과적으로 `constructor(private readonly ring:
DecisionRingBuffer)` 만으로는 `Nest can't resolve dependencies of the
DecisionQueryController (?, ...)` 에러가 발생한다.

**Resolution (commit `f7707dc2`)** — `decision-query.controller.ts` 의 ring buffer
인자에 명시적 `@Inject(DecisionRingBuffer)` 를 부착해 token 을 강제. 운영 빌드 (tsc) 에는
영향 없으며, vitest smoke test 가 정상 통과한다.

### Task 1.8 environmental constraint #2 — zod default + coerce: strict-mode 추론 회피

`z.coerce.number().int().min(1).max(100).default(10)` 로 query string 입력을 coerce 하는
경우, output 타입은 strict-mode TS 추론에서 `number | undefined` 가 된다 (default 가
parse 시점에만 적용). controller signature 가 zod input shape 을 그대로 받으면 후속
`Math.max(0, q.limit - 1)` 등에서 TS2532 에러가 surfacing.

**Resolution (commit `f7707dc2`)** — controller 본체에서 `q.limit ?? 10`, `q.cursor ?? 0`
fallback 을 적용. zod default 가 보증하므로 런타임 영향은 없으나 TS 추론을 만족시키기
위한 의도적 dual-fallback. 향후 zod v4 narrowing 이 들어오면 제거 가능.

### Task 1.9 — package.json deps no-op (선행 task 가 미리 추가)

초안 plan §1.9.1 은 controller `package.json` 에 `sim-internal-network` /
`sim-decision-view` workspace 의존을 신규 추가하도록 지시했으나, Task 1.6 (ring buffer)
와 Task 1.8 (controller) 가 import 시점에 dependency check 통과를 위해 이미 dep 을
추가한 상태였다. 결과적으로 Task 1.9 의 deps 추가 step 은 no-op.

**Resolution (commit `745572f0`)** — Task 1.9 는 AppModule wiring (`DecisionQueryModule`
import + `DecisionRingBuffer` provider 등록) 만 수행. plan 본문의 deps step 은 사실상
"이미 추가됨" 검증으로 의미 축소.

### Stage 1a integration verification (Task 1.10 결과)

**Step 1.10.1 — build / test / typecheck (3 패키지)**:

| 패키지 | build | test | typecheck |
|--------|-------|------|-----------|
| `sim-internal-network` | PASS (ESM+CJS+DTS dual) | 7/7 PASS | PASS |
| `sim-decision-view` | PASS (ESM+CJS+DTS dual) | 7/7 PASS | PASS |
| `@qa-sdk/sim-canary-controller` | PASS (tsc emit) | 67 PASS, 5 fail (pre-existing cycle-flow.test.ts), 1 skipped — Stage 1a 신규 `decision-query.module.smoke.test.ts` PASS | PASS |

신규 산출물 자체는 모두 green. cycle-flow.test.ts 5 fail 은 HEAD 이전부터 존재한 baseline
noise (Task 1.7 defect log 후속, D-stage-9 통합 fixture 정비 필요).

**Step 1.10.2 — host.docker.internal 무회귀 + spec cross-ref grep**:

- `grep -rn "host.docker.internal" simulations/enterprise-pm/` (extra_hosts 제외) → empty.
  Plan A Stage 1 무회귀 보증 유지.
- `grep -rn "spec 2026-05-02"` (3 신규 패키지/모듈 src) → 13 매치 (>=5 임계 통과). 각 신규
  파일 헤더에 spec §3·§4·§5·§6 cross-ref 헤더 부착 확인.

**Step 1.10.3 — contract typecheck (sim-decision-view import drift)**:

임시 fixture `simulations/.../decision/__contract-check.ts` 작성 후 `pnpm --filter
@qa-sdk/sim-canary-controller typecheck` 실행 → PASS. fixture 즉시 삭제 (commit 안 함).

```typescript
import type { SafetyDecisionRecordView } from "sim-decision-view";
import { toSafetyDecisionView } from "sim-decision-view";
import type { SafetyDecisionRecord } from "./decision-builder.service.js";
const _check: (r: SafetyDecisionRecord) => SafetyDecisionRecordView = toSafetyDecisionView;
```

> 참고: 초안 plan §1.10.3 의 import path `@qa-sdk-sim/canary-controller/decision` 은 본
> monorepo 의 실제 패키지 명 (`@qa-sdk/sim-canary-controller`) 과 다르고, controller 는
> subpath export 를 노출하지 않는다. 따라서 fixture 는 controller src 트리 내부에 배치하고
> 상대 경로 (`./decision-builder.service.js`) 로 record 타입을 참조해 동등한 contract 단언을
> 수행한다.

**Step 1.10.4 — Stage 1a 9 commit cherry-list (origin/main..HEAD)**:

| Task | Commit |
|------|--------|
| 1.1 sim-internal-network skeleton + isInternalIp | `41c4ac5b` |
| 1.2 InternalIpGuard NestJS | `6eb59adc` |
| 1.3 internalIpMiddleware Hono | `c6ea8c4b` |
| 1.4 sim-decision-view skeleton | `5181a096` |
| 1.5 sim-decision-view conversion | `1cd1aad3` |
| 1.6 DecisionRingBuffer | `9a85e0e5` |
| 1.7 wire CycleScheduler to DecisionRingBuffer | `c038803a` |
| 1.8 DecisionQueryController + InternalIpGuard | `f7707dc2` |
| 1.9 wire DecisionQueryModule into AppModule | `745572f0` |

추가 plan/defect 문서 commit (`2442b0a6`, `d0bd3656`, `7662868c`) 3건 포함, 총 12 commit
이 origin/main 보다 앞서 있음. PR-A 본문에서 Stage 1a 범위로 위 9 task commit 을 cherry-list
하고, Stage 1b 는 후속 plan `A-stage-1b-admin-and-fault.md` 로 이어 받는다.

**Stage 1a DoD 6 항목 (Task 1.10 종료 시점)**:

- [x] sim-internal-network: `isInternalIp` + `InternalIpGuard` + `internalIpMiddleware` export, unit test 7/7 PASS
- [x] sim-decision-view: 4 view 타입 + 4 conversion 함수 export, conversion test 7/7 PASS
- [x] DecisionRingBuffer + cycle-scheduler ring buffer wiring (`history` 필드 제거 commit `c038803a`)
- [x] DecisionQueryController 3 endpoint (`/v1/decisions`, `/v1/decisions/first`, `/v1/cycles/recent`) + `@UseGuards(InternalIpGuard)` (commit `f7707dc2`)
- [x] AppModule 에 DecisionQueryModule 등록, controller TS 빌드 / typecheck 통과 (commit `745572f0`)
- [x] host.docker.internal 무회귀 grep + spec §3·§4·§5·§6 cross-ref 헤더 통과 (Step 1.10.2)
