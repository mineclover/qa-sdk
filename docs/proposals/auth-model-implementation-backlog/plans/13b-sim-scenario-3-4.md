---
lifecycle: draft
plan: 13b
phase: 4
depends-on: [13a, 11b, 12c]
sources:
  - simulations/enterprise-pm/scenarios/src/scenarios/scenario-3-self-dept-approval.ts
  - simulations/enterprise-pm/scenarios/src/scenarios/scenario-3-self-dept-approval.test.ts
  - simulations/enterprise-pm/scenarios/src/scenarios/scenario-4-cross-dept-deny.ts
  - simulations/enterprise-pm/scenarios/src/scenarios/scenario-4-cross-dept-deny.test.ts
  - simulations/enterprise-pm/scenarios/src/scenarios/lib/audit-helpers.ts
  - simulations/enterprise-pm/scenarios/src/env/in-process-env.ts
  - simulations/enterprise-pm/scenarios/src/cli.ts
  - docs/specs/sim-erp-pm-coverage.spec.md
---

# Plan 13b — sim 시나리오 3, 4 (단일 승인 + cross-department deny)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 13a의 runner 프레임워크 위에 시나리오 3, 4를 구현한다. (1) **시나리오 3** — alice (engineering 부서 manager) 가 자기 부서 100만원 budget request를 **단일 step**으로 승인 → approval-api state machine `submitted → approved` transition 검증 + audit nested tree (execution + Pass 1 + Pass 2 lifecycle) 영속 검증. (2) **시나리오 4** — bob (marketing 부서 사용자) 가 engineering 부서의 budget request를 단독 승인 시도 → AccessChecker가 RLS scoping 위반으로 **deny** + decision replay (`audit-recorder.firstFailure`)로 첫 실패 step (Pass 2 lifecycle deny — `not_in_scope`)이 정확히 노출됨을 검증. 두 시나리오는 design.md §4 매트릭스의 핵심 — RLS scoping과 decision replay의 e2e 증명.

**Architecture:**
- **시나리오 3 (단일 승인 happy path)**:
  - setup: alice (engineering manager, role=approver scopeType=department scopeId=dept-eng), engineering 부서에 미결 budget request (amount=1_000_000, currentStage=1, totalStages=1)
  - act:
    1. login (alice) → token
    2. POST /approvals/requests/:id/decisions { decision: "approve", comment } → 200
    3. GET /approvals/requests/:id → status="approved"
    4. GET /audit/trace/:rootSpanId → entries (execution + 2 check)
  - assert:
    1. transition 응답 OK
    2. status=approved, currentStage=1 완료
    3. audit tree에 root execution + Pass 1 (bitmap allow) + Pass 2 (lifecycle allow — REGISTERED + dept scope match)
    4. firstFailure → null (모두 allow)
- **시나리오 4 (cross-dept deny + decision replay)**:
  - setup: bob (marketing user, role=approver scopeType=department scopeId=dept-marketing), engineering 부서 budget request (alice 시나리오 3과 동일 또는 별도)
  - act:
    1. login (bob) → token
    2. POST /approvals/requests/:id/decisions { decision: "approve", comment } → 403
    3. GET /audit/trace/:rootSpanId → entries
    4. GET /audit/firstFailure/:rootSpanId → first deny entry
  - assert:
    1. POST 응답 403 (or 401 if RLS at DB level prevents reads — 본 plan은 application-level deny에 집중. RLS는 Phase 3 완료 후 자동 강화)
    2. audit tree에 deny check entry 1+ (Pass 2 lifecycle deny, denyReason="not_in_scope" or "cross_dept_denied")
    3. firstFailure 응답이 정확히 위 deny entry — `outcome: "deny"`, `denyReason` 명시
    4. decision replay 가능 — `firstFailure.spanId`로 GET /audit/entry/:id 조회 → 동일 entry 복원
- **3 → 4 시나리오 격리**: 각 시나리오는 fresh in-process bootstrap — fixture seed 후 fresh DB. setup이 시나리오별 fixture를 추가 시드 (alice/bob, engineering/marketing dept).
- **AccessChecker integration 가정**:
  - approval-api는 transition 호출 전 `AccessChecker.check({ kind: "transaction", apiId: "budget.approve", coords: [...], targetId: requestId })` 호출
  - Pass 1 (bitmap)에서 alice는 budget_request의 approve action 비트 set, bob도 set (둘 다 approver role) — Pass 1만으로는 cross-dept 거절 불가
  - Pass 2 (lifecycle / scope check) — bob의 RoleAssignment scopeType=department scopeId=dept-marketing이 request의 departmentId=dept-eng과 mismatch → deny
- **ScenarioCtx 공유 헬퍼**: setup/act 단계에서 fixture (alice, bob, request) 정보를 ctx에 저장. assert에서 ctx 참조.

**Tech Stack:**
- 13a와 동일 + sim-approval-api 추가
- `audit-recorder-store` factory + audit-browser-api 통합 (Plan 12c 결과물)

## 현재 증거 표면 ^evidence

- 시나리오 3/4 구현과 테스트는 `simulations/enterprise-pm/scenarios/src/scenarios/` 아래 `scenario-3-*`, `scenario-4-*` 파일이 소유한다.
- `src/cli.ts`는 두 시나리오를 `ALL_SCENARIOS` registry에 포함한다.
- `sim-erp-pm-coverage.spec.md`는 시나리오 3/4를 approval state machine, deny path, decision replay 회귀 게이트로 추적한다.

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/scenarios/src/scenarios/
├── scenario-3-self-dept-approval.ts
├── scenario-3-self-dept-approval.test.ts
├── scenario-4-cross-dept-deny.ts
├── scenario-4-cross-dept-deny.test.ts
└── lib/
    ├── audit-helpers.ts         # GET /audit/trace + firstFailure 호출 헬퍼
    └── audit-helpers.test.ts
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `src/cli.ts` (Plan 13a) | `ALL_SCENARIOS`에 scenario3/4 추가 |
| `src/cli.test.ts` | 시나리오 카운트 4건으로 갱신 |
| `src/env/in-process-env.ts` (Plan 13a) | approval-api + audit-browser-api 추가 부팅 + bob fixture 시드 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/scenarios/src/scenarios/scenario-1-login.ts && \
  ls simulations/enterprise-pm/services/approval-api/src/budget/budget.controller.ts && \
  ls simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.controller.ts
```

Expected: Plan 13a (1/2 시나리오) + Plan 11b (BudgetRequest controller) + Plan 12c (AuditExplorer) 모두 hit.

- [ ] **Step 2: 13a 단위 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test 2>&1 | tail -3
```

Expected: 12 PASS (in-process skip 시).

---

## Task 1: in-process-env 확장 — approval-api + audit-browser-api + bob fixture

**Files:**
- Modify: `simulations/enterprise-pm/scenarios/src/env/in-process-env.ts`

- [ ] **Step 1: InProcessHandle 인터페이스 확장**

```ts
export interface InProcessHandle {
  authApp: INestApplication;
  pmApp: INestApplication;
  approvalApp: INestApplication;       // ← 신규
  auditBrowserApp: INestApplication;   // ← 신규
  gatewayFetch: (req: Request) => Promise<Response>;
  cleanup(): Promise<void>;
  fixtures: {
    alice: { id: string; email: string; password: string; departmentId: string };
    bob: { id: string; email: string; password: string; departmentId: string };
    project_lead_role: { id: string };
    approver_role: { id: string };     // ← 신규
    departments: { eng: string; marketing: string };  // ← 신규
    /** Plan 13b/c가 setup에서 추가 시드. */
    seedBudgetRequest(args: { departmentId: string; amount: number; requesterId: string }): Promise<{ id: string }>;
  };
}
```

- [ ] **Step 2: bootstrapInProcess에 approval/audit 부팅 + fixture 추가**

```ts
const { AppModule: ApprovalAppModule, seedApprovalFixtures } = await import(
  // @ts-ignore
  "@qa-sdk/sim-approval-api/test-bootstrap"
) as { AppModule: never; seedApprovalFixtures: (app: INestApplication) => Promise<{ approver_role: { id: string } }> };

const { AppModule: AuditAppModule } = await import(
  // @ts-ignore
  "@qa-sdk/sim-audit-browser-api/test-bootstrap"
) as { AppModule: never };

const approvalModuleRef = await Test.createTestingModule({ imports: [ApprovalAppModule as never] }).compile();
const approvalApp = approvalModuleRef.createNestApplication();
await approvalApp.init();
await approvalApp.listen(0);
const approvalPort = (approvalApp.getHttpServer().address() as { port: number }).port;

const auditModuleRef = await Test.createTestingModule({ imports: [AuditAppModule as never] }).compile();
const auditBrowserApp = auditModuleRef.createNestApplication();
await auditBrowserApp.init();
await auditBrowserApp.listen(0);
const auditPort = (auditBrowserApp.getHttpServer().address() as { port: number }).port;

const gatewayApp = createApp({
  authApiUrl: `http://localhost:${authPort}`,
  jwtSecret: opts.jwtSecret,
  jwtTtlSeconds: 300,
  currentBitmapV: "uv1",
  proxyTimeoutMs: 5000,
  proxyTargets: {
    "sim-pm-api": `http://localhost:${pmPort}`,
    "sim-approval-api": `http://localhost:${approvalPort}`,
    "sim-notification-api": "http://127.0.0.1:1",
    "sim-reporting-api": "http://127.0.0.1:1",
    "sim-document-api": "http://127.0.0.1:1",
    "sim-audit-browser-api": `http://localhost:${auditPort}`,
  },
});

const authFixtures = await seedAuth(authApp);
const approvalFixtures = await seedApprovalFixtures(approvalApp);

return {
  authApp,
  pmApp,
  approvalApp,
  auditBrowserApp,
  gatewayFetch: (req) => gatewayApp.fetch(req),
  fixtures: {
    ...authFixtures,
    ...approvalFixtures,
    seedBudgetRequest: async (args) => {
      // approval-api에 in-memory request 생성 (test helper 활용)
      const { createTestBudgetRequest } = await import(
        // @ts-ignore
        "@qa-sdk/sim-approval-api/test-bootstrap"
      ) as { createTestBudgetRequest: (app: INestApplication, args: { departmentId: string; amount: number; requesterId: string }) => Promise<{ id: string }> };
      return createTestBudgetRequest(approvalApp, args);
    },
  },
  cleanup: async () => {
    await auditBrowserApp.close();
    await approvalApp.close();
    await pmApp.close();
    await authApp.close();
  },
};
```

**중요**: `seedApprovalFixtures` / `createTestBudgetRequest`는 sim-approval-api의 test-bootstrap entry에서 export. Plan 11b 마지막에 보강 또는 본 plan에서 추가.

- [ ] **Step 3: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios typecheck 2>&1 | tail -5
```

Expected: 0 error.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/env/in-process-env.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): in-process env에 approval-api + audit-browser-api + bob fixture

bootstrapInProcess가 4 NestJS app + Hono gateway 통합 부팅.
fixtures.bob (marketing dept), approver_role, seedBudgetRequest 헬퍼 추가.
gateway proxyTargets에 approval/audit 포트 주입.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: lib/audit-helpers — 시나리오 공용 audit 조회 헬퍼

**Files:**
- Create: `src/scenarios/lib/audit-helpers.ts`
- Create: `src/scenarios/lib/audit-helpers.test.ts`

- [ ] **Step 1: audit-helpers.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-nested-audit-tracing

import type { AuditEntry } from "permission-engine";

export interface AuditTraceResponse {
  rootSpanId: string;
  count: number;
  entries: AuditEntry[];
}

export interface AuditFirstFailureResponse {
  rootSpanId: string;
  firstFailure: AuditEntry | null;
}

/**
 * gateway 경유로 audit-browser-api의 trace listing 조회.
 */
export async function fetchAuditTrace(
  gatewayFetch: (req: Request) => Promise<Response>,
  rootSpanId: string,
  authToken: string,
): Promise<AuditTraceResponse> {
  const res = await gatewayFetch(new Request(`http://sim/audit/trace/${rootSpanId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }));
  if (!res.ok) {
    throw new Error(`fetchAuditTrace ${rootSpanId}: status=${res.status} body=${await res.text()}`);
  }
  return (await res.json()) as AuditTraceResponse;
}

export async function fetchFirstFailure(
  gatewayFetch: (req: Request) => Promise<Response>,
  rootSpanId: string,
  authToken: string,
): Promise<AuditFirstFailureResponse> {
  const res = await gatewayFetch(new Request(`http://sim/audit/firstFailure/${rootSpanId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }));
  if (!res.ok) {
    throw new Error(`fetchFirstFailure ${rootSpanId}: status=${res.status} body=${await res.text()}`);
  }
  return (await res.json()) as AuditFirstFailureResponse;
}

export async function fetchAuditEntry(
  gatewayFetch: (req: Request) => Promise<Response>,
  spanId: string,
  authToken: string,
): Promise<AuditEntry> {
  const res = await gatewayFetch(new Request(`http://sim/audit/entry/${spanId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }));
  if (!res.ok) {
    throw new Error(`fetchAuditEntry ${spanId}: status=${res.status} body=${await res.text()}`);
  }
  return (await res.json()) as AuditEntry;
}
```

- [ ] **Step 2: audit-helpers.test.ts (mock fetch)**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchAuditTrace, fetchFirstFailure, fetchAuditEntry } from "./audit-helpers.js";

describe("audit-helpers", () => {
  it("fetchAuditTrace — 200 → 응답 deserialize", async () => {
    const gw = vi.fn(async (req: Request) => {
      expect(req.url).toContain("/audit/trace/root-1");
      expect(req.headers.get("authorization")).toBe("Bearer t");
      return Response.json({ rootSpanId: "root-1", count: 2, entries: [] });
    });
    const res = await fetchAuditTrace(gw, "root-1", "t");
    expect(res.count).toBe(2);
  });

  it("fetchFirstFailure — null 응답", async () => {
    const gw = vi.fn(async () => Response.json({ rootSpanId: "r", firstFailure: null }));
    const res = await fetchFirstFailure(gw, "r", "t");
    expect(res.firstFailure).toBeNull();
  });

  it("fetchAuditEntry — 404 → throw", async () => {
    const gw = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(fetchAuditEntry(gw, "missing", "t")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test -- audit-helpers
```

Expected: 3 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/lib && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): lib/audit-helpers — gateway 경유 audit 조회

fetchAuditTrace / fetchFirstFailure / fetchAuditEntry.
Plan 12c의 audit-browser-api 3 endpoint와 1:1 매칭.
401/404는 throw — silent fallback 없음.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: scenario-3-self-dept-approval (TDD)

**Files:**
- Create: `src/scenarios/scenario-3-self-dept-approval.ts`
- Create: `src/scenarios/scenario-3-self-dept-approval.test.ts`

- [ ] **Step 1: scenario-3-self-dept-approval.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import { fetchAuditTrace, fetchFirstFailure } from "./lib/audit-helpers.js";

interface S3Ctx {
  approver: { email: string; password: string };
  request: { id: string; departmentId: string; amount: number };
}

/**
 * 시나리오 3 — 자기 부서 budget 100만원 단일 step 승인.
 *
 * 검증 대상:
 *   - state machine: submitted → approved (단일 stage)
 *   - AccessChecker Pass 1 (bitmap allow) + Pass 2 (lifecycle / dept scope match)
 *   - audit nested tree: execution + 2 check entry
 *   - firstFailure → null (전부 allow)
 */
export const scenario3SelfDeptApproval: Scenario<S3Ctx> = {
  name: "scenario-3-self-dept-approval",
  description: "alice (engineering manager) — 자기 부서 100만원 단일 승인",
  validates: [
    "approval state machine submitted→approved",
    "AccessChecker 2-pass allow",
    "audit nested tree (3 entry)",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: { fixtures: { alice: { email: string; password: string; departmentId: string }; departments: { eng: string }; seedBudgetRequest: (args: { departmentId: string; amount: number; requesterId: string }) => Promise<{ id: string }> } } }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound — in-process bootstrap required");
    const request = await handle.fixtures.seedBudgetRequest({
      departmentId: handle.fixtures.departments.eng,
      amount: 1_000_000,
      requesterId: "user-someone-else", // alice가 승인자, requester는 다른 user
    });
    return {
      approver: { email: handle.fixtures.alice.email, password: handle.fixtures.alice.password },
      request: { id: request.id, departmentId: handle.fixtures.departments.eng, amount: 1_000_000 },
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. login (alice)
    const loginRes = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.approver),
    }));
    if (!loginRes.ok) throw new Error(`login: ${loginRes.status}`);
    const { token } = (await loginRes.json()) as { token: string };
    traceIds.push(loginRes.headers.get("x-trace-id") ?? "");

    // 2. POST decision
    const approveRes = await gatewayFetch(new Request(
      `http://sim/approvals/requests/${ctx.request.id}/decisions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision: "approve", comment: "OK from scenario 3" }),
      },
    ));
    const approveTraceId = approveRes.headers.get("x-trace-id") ?? "";
    if (approveTraceId) traceIds.push(approveTraceId);
    if (!approveRes.ok) {
      throw new Error(`approve: status=${approveRes.status} body=${await approveRes.text()}`);
    }
    const approved = (await approveRes.json()) as { rootSpanId: string; status: string };

    // 3. GET request status
    const getRes = await gatewayFetch(new Request(`http://sim/approvals/requests/${ctx.request.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }));
    if (!getRes.ok) throw new Error(`get: ${getRes.status}`);
    const fetched = (await getRes.json()) as { id: string; status: string; currentStage: number };

    // 4. audit trace
    const trace = await fetchAuditTrace(gatewayFetch, approved.rootSpanId, token);
    const ff = await fetchFirstFailure(gatewayFetch, approved.rootSpanId, token);

    return {
      data: {
        approveStatus: approveRes.status,
        approvedRootSpanId: approved.rootSpanId,
        approvedResponseStatus: approved.status,
        finalStatus: fetched.status,
        auditEntryCount: trace.count,
        auditEntries: trace.entries,
        firstFailure: ff.firstFailure,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 4,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    equal(d.approveStatus, 200, `approve POST should be 200`);
    equal(d.approvedResponseStatus, "approved", `state should transition to approved`);
    equal(d.finalStatus, "approved", `GET response should reflect approved`);

    // audit nested tree: 최소 3 entry (execution + Pass 1 bitmap + Pass 2 lifecycle)
    const count = d.auditEntryCount as number;
    ok(count >= 3, `audit count must be ≥ 3 (execution + 2 check), got ${count}`);

    const entries = d.auditEntries as Array<{ kind: string; outcome?: string }>;
    const execEntries = entries.filter((e) => e.kind === "execution");
    const checkEntries = entries.filter((e) => e.kind === "check");
    ok(execEntries.length >= 1, "must have ≥ 1 execution entry");
    ok(checkEntries.length >= 2, `must have ≥ 2 check entries, got ${checkEntries.length}`);
    ok(checkEntries.every((c) => c.outcome === "allow"), "all check entries must be allow");

    // firstFailure null — 모두 allow
    equal(d.firstFailure, null, "firstFailure must be null (all allow)");
  },

  async teardown() {},
};
```

- [ ] **Step 2: scenario-3 test**

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario3SelfDeptApproval } from "./scenario-3-self-dept-approval.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 3 — self-dept approval", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: "x".repeat(32), dialect: "sqlite" });
    const g = globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch; __simHandle: typeof handle };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => { if (handle) await handle.cleanup(); });

  it("scenario 3 통과", async () => {
    const result = await runScenario(scenario3SelfDeptApproval, {
      gatewayUrl: "http://sim-inproc", mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 3 실패]", result.error);
    }
    expect(result.status).toBe("passed");
    expect(result.stepCount).toBe(4);
  }, 30_000);
});
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-3-self-dept-approval.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-3-self-dept-approval.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 3 — alice 자기 부서 100만원 단일 승인

state machine: submitted→approved 단일 stage.
audit nested tree: execution + Pass 1 bitmap allow + Pass 2 lifecycle allow.
firstFailure null — 전부 allow가 증거.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: scenario-4-cross-dept-deny (TDD)

**Files:**
- Create: `src/scenarios/scenario-4-cross-dept-deny.ts`
- Create: `src/scenarios/scenario-4-cross-dept-deny.test.ts`

- [ ] **Step 1: scenario-4-cross-dept-deny.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal, notEqual } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import { fetchAuditTrace, fetchFirstFailure, fetchAuditEntry } from "./lib/audit-helpers.js";

interface S4Ctx {
  badApprover: { email: string; password: string };
  /** good approver — 본 시나리오의 audit/firstFailure 조회는 alice token 사용 (본인이 deny 안 됨). */
  goodApprover: { email: string; password: string };
  request: { id: string; departmentId: string };
}

/**
 * 시나리오 4 — bob (marketing) 가 engineering 부서 budget 단독 승인 시도 → deny.
 *
 * 검증 대상:
 *   - RLS scoping: bob.RoleAssignment scopeId=marketing != request.departmentId=engineering
 *   - AccessChecker Pass 2 (lifecycle / scope) deny — denyReason="not_in_scope" 또는 "cross_dept_denied"
 *   - audit-recorder.firstFailure가 정확히 위 deny entry 노출
 *   - decision replay: firstFailure.spanId로 GET /audit/entry/:id 조회 → 동일 entry 복원
 */
export const scenario4CrossDeptDeny: Scenario<S4Ctx> = {
  name: "scenario-4-cross-dept-deny",
  description: "bob (marketing) — engineering 부서 budget 단독 승인 시도 → deny + replay",
  validates: [
    "RLS scoping (Phase 3)",
    "AccessChecker 2-pass deny path",
    "audit firstFailure (decision replay)",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: {
      fixtures: {
        alice: { email: string; password: string };
        bob: { email: string; password: string };
        departments: { eng: string };
        seedBudgetRequest: (args: { departmentId: string; amount: number; requesterId: string }) => Promise<{ id: string }>;
      };
    } }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    const req = await handle.fixtures.seedBudgetRequest({
      departmentId: handle.fixtures.departments.eng,
      amount: 500_000,
      requesterId: "user-eng-someone",
    });
    return {
      badApprover: { email: handle.fixtures.bob.email, password: handle.fixtures.bob.password },
      goodApprover: { email: handle.fixtures.alice.email, password: handle.fixtures.alice.password },
      request: { id: req.id, departmentId: handle.fixtures.departments.eng },
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. bob login
    const bobLogin = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.badApprover),
    }));
    if (!bobLogin.ok) throw new Error(`bob login: ${bobLogin.status}`);
    const { token: bobToken } = (await bobLogin.json()) as { token: string };
    traceIds.push(bobLogin.headers.get("x-trace-id") ?? "");

    // 2. bob attempts approve → expect 403
    const denyRes = await gatewayFetch(new Request(
      `http://sim/approvals/requests/${ctx.request.id}/decisions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${bobToken}` },
        body: JSON.stringify({ decision: "approve", comment: "bob trying" }),
      },
    ));
    traceIds.push(denyRes.headers.get("x-trace-id") ?? "");

    let denyBody: { rootSpanId?: string; error?: string; denyReason?: string } = {};
    try {
      denyBody = await denyRes.json();
    } catch {
      // body가 JSON 아닐 수 있음
    }

    // 3. alice login (audit 조회 권한)
    const aliceLogin = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.goodApprover),
    }));
    if (!aliceLogin.ok) throw new Error(`alice login: ${aliceLogin.status}`);
    const { token: aliceToken } = (await aliceLogin.json()) as { token: string };

    // 4. audit trace + firstFailure (alice token으로 — bob는 audit 권한 없음 가정)
    let trace: Awaited<ReturnType<typeof fetchAuditTrace>> | null = null;
    let firstFailure: Awaited<ReturnType<typeof fetchFirstFailure>> | null = null;
    let replayedEntry: Awaited<ReturnType<typeof fetchAuditEntry>> | null = null;

    if (denyBody.rootSpanId) {
      trace = await fetchAuditTrace(gatewayFetch, denyBody.rootSpanId, aliceToken);
      firstFailure = await fetchFirstFailure(gatewayFetch, denyBody.rootSpanId, aliceToken);
      // decision replay
      if (firstFailure.firstFailure) {
        replayedEntry = await fetchAuditEntry(gatewayFetch, firstFailure.firstFailure.spanId, aliceToken);
      }
    }

    return {
      data: {
        denyStatus: denyRes.status,
        denyBody,
        rootSpanId: denyBody.rootSpanId ?? null,
        trace,
        firstFailure,
        replayedEntry,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 4,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    // denyStatus는 403 (application-level deny). RLS가 DB 레벨에서 막으면 401/404 가능 — 본 시나리오는 application 우선.
    ok(d.denyStatus === 403, `expected 403, got ${d.denyStatus}`);

    const ff = d.firstFailure as Awaited<ReturnType<typeof fetchFirstFailure>> | null;
    ok(ff && ff.firstFailure, "firstFailure must exist");
    const failure = ff!.firstFailure as { kind: string; outcome: string; pass?: string; denyReason?: string };
    equal(failure.outcome, "deny", "firstFailure must be deny");
    ok(failure.kind === "check", `firstFailure must be check entry`);
    ok(
      failure.pass === "lifecycle" || failure.denyReason?.includes("scope") || failure.denyReason?.includes("dept"),
      `firstFailure must indicate scope/dept mismatch: pass=${failure.pass} denyReason=${failure.denyReason}`,
    );

    // decision replay — 동일 entry 복원
    const replay = d.replayedEntry as { spanId: string; outcome: string };
    ok(replay, "replay entry must exist");
    equal(replay.spanId, failure.spanId as never, "replayed entry spanId must match firstFailure");
    equal(replay.outcome, "deny", "replayed entry outcome must be deny");
  },

  async teardown() {},
};
```

- [ ] **Step 2: scenario-4 test**

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario4CrossDeptDeny } from "./scenario-4-cross-dept-deny.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 4 — cross-dept deny + decision replay", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: "x".repeat(32), dialect: "sqlite" });
    const g = globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch; __simHandle: typeof handle };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => { if (handle) await handle.cleanup(); });

  it("scenario 4 통과", async () => {
    const result = await runScenario(scenario4CrossDeptDeny, {
      gatewayUrl: "http://sim-inproc", mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 4 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 30_000);
});
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-4-cross-dept-deny.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-4-cross-dept-deny.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 4 — bob cross-dept deny + decision replay

403 + audit firstFailure가 lifecycle Pass 2 deny entry 노출.
decision replay: firstFailure.spanId → GET /audit/entry/:id → 동일 entry 복원.
RLS scoping이 application-level에서 정확히 차단됨을 증명.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: cli.ts에 scenario3, 4 등록

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli.test.ts`

- [ ] **Step 1: cli.ts 갱신**

```ts
import { scenario3SelfDeptApproval } from "./scenarios/scenario-3-self-dept-approval.js";
import { scenario4CrossDeptDeny } from "./scenarios/scenario-4-cross-dept-deny.js";

export const ALL_SCENARIOS: readonly Scenario[] = [
  scenario1Login,
  scenario2ProjectCreate,
  scenario3SelfDeptApproval,
  scenario4CrossDeptDeny,
  // Plan 13c/d가 5~8 추가
];
```

- [ ] **Step 2: cli.test.ts 갱신**

```ts
it("ALL_SCENARIOS — Plan 13b 시점에 4건 (1~4)", () => {
  expect(ALL_SCENARIOS).toHaveLength(4);
  expect(ALL_SCENARIOS.map((s) => s.name)).toEqual([
    "scenario-1-login",
    "scenario-2-project-create",
    "scenario-3-self-dept-approval",
    "scenario-4-cross-dept-deny",
  ]);
});
```

- [ ] **Step 3: 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test 2>&1 | tail -5 && \
  pnpm --filter @qa-sdk/sim-scenarios build && \
  cd simulations/enterprise-pm/scenarios && node dist/cli.js list
```

Expected: 12 → 15 PASS (cli + audit-helpers 신규 3 추가, in-process scenario는 env gate). list 출력에 4 시나리오.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/cli.ts \
          simulations/enterprise-pm/scenarios/src/cli.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): scenario3, 4를 ALL_SCENARIOS에 등록

Plan 13b — 시나리오 등록 + cli 회귀.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- [ ] 시나리오 3 — alice (engineering manager) 자기 부서 100만원 단일 승인 happy path
- [ ] state machine submitted → approved 검증
- [ ] audit nested tree (execution + Pass 1 + Pass 2) 영속 확인
- [ ] firstFailure null (전부 allow)
- [ ] 시나리오 4 — bob (marketing) cross-dept 단독 승인 → 403
- [ ] firstFailure가 정확히 Pass 2 lifecycle deny entry — denyReason scope/dept 명시
- [ ] decision replay — firstFailure.spanId로 GET /audit/entry/:id → 동일 entry 복원
- [ ] in-process bootstrap에 approval-api + audit-browser-api + bob fixture 통합
- [ ] cli ALL_SCENARIOS 4건으로 갱신
- [ ] 누적 PASS: 13a 12 + audit-helpers 3 = 15 + in-process 4건 (env gate 활성화 시 19)

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| RLS DB-level deny (postgres RLS policy) | Phase 3 §3 RLS 완료 후 — 본 시나리오는 application-level 검증으로 충분 | Phase 3 |
| Approval workflow 'reject' / 'revision_requested' transition | Plan 13c/d에서 다단계 승인 시나리오 | 13c |
| audit-recorder의 OtelAuditRecorder 통합 검증 (trace_id 일치) | Plan 12c 결과 활용 — 본 plan은 firstFailure 자체에 집중 | 13d / 14b |

---

## 의존·후속

- **Plan 13a**: runner / cli / in-process bootstrap base.
- **Plan 11b**: BudgetRequest controller + state machine.
- **Plan 12c**: AuditExplorer (audit-browser-api) + OtelAuditRecorder.
- **Plan 13c**: 시나리오 5, 6 (3단계 승인 + DELEGATED).
- **Plan 13d**: 시나리오 7, 8 (refresh + invalidation).
- **Plan 14a**: 본 시나리오 실행 결과로 marginal density 측정.
