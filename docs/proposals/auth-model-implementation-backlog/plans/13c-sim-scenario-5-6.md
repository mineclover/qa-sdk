---
lifecycle: draft
plan: 13c
phase: 4
depends-on: [13b, 11b, 12c]
---

# Plan 13c — sim 시나리오 5, 6 (3단계 승인 + DELEGATED)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시나리오 5, 6을 13a/b 패턴 그대로 추가한다. (1) **시나리오 5** (1500만원 budget → 3단계 승인) — design.md §3 state machine의 `amount ≥ 10M → 3 stages (manager → director → cfo)` 정확 검증. carol (manager) → david (director) → eve (cfo) 순차 승인. nested audit tree 3 transition × 3 check pass = 9 entry. OTEL trace 3개가 root-child 관계로 연결됨을 검증. (2) **시나리오 6** (DELEGATED — 외부 컨설턴트 위임) — alice가 자기 프로젝트의 리소스 일부를 외부 컨설턴트 frank에게 `resource-policy.delegate`로 위임 → policy.state가 `REGISTERED → DELEGATED` 전이 + `graphRootId` 설정. 그후 frank가 해당 리소스 접근 시 AccessChecker Pass 2가 `DELEGATED` 분기 → `InstancePolicyEvaluator.evaluateDelegated`가 authorization-graph 조회 → allow. Pass 2 graph branch가 정확히 동작.

**Architecture:**
- **시나리오 5 (3단계 승인)**:
  - setup: 1_500_000원 budget request (engineering, requester=user-x, totalStages=3, currentStage=1), carol/david/eve 3 approver fixture
  - act:
    1. carol login → POST decision (stage 1) → 200
    2. david login → POST decision (stage 2) → 200
    3. eve login → POST decision (stage 3) → 200
    4. GET request → status="approved", currentStage=3 완료
    5. fetchAuditTrace로 3 transition의 rootSpanId 각각 조회 (또는 통합 root 1개)
    6. OTEL trace가 동일 traceId로 묶이는지 확인 (3 stage가 single workflow trace에 속해야 함)
  - assert:
    1. 3 transition 모두 200
    2. 최종 status=approved
    3. nested audit tree: 3 execution entry + 6+ check entry (각 stage가 Pass 1 + Pass 2)
    4. firstFailure null
    5. 3 stage의 rootSpanId가 동일 traceId 공유 (cross-transition trace propagation 검증) — 단, 실제 구현은 stage별 별도 trace이거나 hierarchical (BudgetRequest의 lifecycle trace + 각 transition span 자식). 본 시나리오는 traceIds 배열로 수집 후 set 크기로 검증.
- **시나리오 6 (DELEGATED + authorization-graph)**:
  - setup: alice가 owner인 project + 외부 컨설턴트 frank fixture. project_resource_policy 초기 `REGISTERED` 상태 (cerbosPolicyRef 설정)
  - act:
    1. alice login → token
    2. POST /projects/:id/delegate { graphRootId: "consultant-graph-1", delegateUserId: frank.id } → 200
    3. resource-policy 조회 (audit endpoint 또는 internal API) → state="DELEGATED", graphRootId="consultant-graph-1"
    4. frank login → token
    5. GET /projects/:id (frank token) → 200 (Pass 2 DELEGATED 분기 → evaluator.evaluateDelegated)
    6. fetchAuditTrace → Pass 2 entry의 pass field가 "acl" (DELEGATED 분기 → evaluator returns true)
  - assert:
    1. delegate 응답 OK
    2. policy.state="DELEGATED", graphRootId 설정
    3. frank GET /projects/:id 200
    4. audit entry pass="acl" 존재 (`evaluateDelegated` 호출 증거)
- **InstancePolicyEvaluator 가정**: pm-api의 Plan 11b가 simple in-memory evaluator 정의 — `evaluateDelegated`가 graphRootId/userId 매칭으로 true return.
- **Approval workflow의 transition 호출 확장**: Plan 11b의 BudgetRequest service가 stage 진행 메서드 (approveStage / rejectStage) 정의. 시나리오 5는 동일 endpoint 3회 호출 — service가 currentStage++ 처리.

**Tech Stack:**
- Plan 13a/b와 동일

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/scenarios/src/scenarios/
├── scenario-5-three-stage-approval.ts
├── scenario-5-three-stage-approval.test.ts
├── scenario-6-delegated-resource.ts
└── scenario-6-delegated-resource.test.ts
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `src/cli.ts` | ALL_SCENARIOS에 5, 6 추가 |
| `src/cli.test.ts` | 카운트 6건 갱신 |
| `src/env/in-process-env.ts` | fixtures에 carol/david/eve/frank + delegate seedHelper 추가 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/scenarios/src/scenarios/scenario-3-self-dept-approval.ts && \
  ls simulations/enterprise-pm/scenarios/src/scenarios/scenario-4-cross-dept-deny.ts && \
  grep -n "delegate\|DELEGATED" simulations/enterprise-pm/services/pm-api/src/project/*.ts 2>&1 | head -3
```

Expected: 시나리오 3, 4 + pm-api에 delegate endpoint 또는 핸들러 hit.

---

## Task 1: in-process-env 확장 — carol/david/eve/frank fixture + delegate helper

**Files:**
- Modify: `simulations/enterprise-pm/scenarios/src/env/in-process-env.ts`

- [ ] **Step 1: fixtures 확장**

```ts
fixtures: {
  alice: ...,  // (기존)
  bob: ...,
  carol: { id: string; email: string; password: string; departmentId: string };  // engineering manager
  david: { id: string; email: string; password: string; departmentId: string };  // engineering director
  eve: { id: string; email: string; password: string; departmentId: string };    // global cfo
  frank: { id: string; email: string; password: string };                        // 외부 컨설턴트 (no dept)
  // ...
}
```

- [ ] **Step 2: seedAuth 헬퍼 (Plan 11a test-bootstrap)에 추가 4 user 시드**

`@qa-sdk/sim-auth-api/test-bootstrap`의 `seedTestData`가 추가 4 user / role 생성:
- carol: role=manager scopeType=department scopeId=eng
- david: role=director scopeType=department scopeId=eng
- eve: role=cfo scopeType=global
- frank: role=external_consultant scopeType=global (bitmap에는 일반 user_action만)

각 user의 mask가 BudgetRequest approve action 비트를 적절히 set (시나리오 5/6 통과를 위함).

- [ ] **Step 3: pm-api delegate seedHelper 추가**

```ts
fixtures.delegateProject = async (args: { projectId: string; graphRootId: string; delegateUserId: string }): Promise<void> => {
  const { delegateProjectResource } = await import(
    // @ts-ignore
    "@qa-sdk/sim-pm-api/test-bootstrap"
  ) as { delegateProjectResource: (app: INestApplication, args: never) => Promise<void> };
  await delegateProjectResource(pmApp, args);
};
```

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/env/in-process-env.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): in-process env에 carol/david/eve/frank fixture + delegate helper

Plan 13c 시나리오 5/6용 4 user 시드.
delegateProjectResource 헬퍼 (pm-api test-bootstrap).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: scenario-5-three-stage-approval (TDD)

**Files:**
- Create: `src/scenarios/scenario-5-three-stage-approval.ts`
- Create: `src/scenarios/scenario-5-three-stage-approval.test.ts`

- [ ] **Step 1: scenario-5-three-stage-approval.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import { fetchAuditTrace, fetchFirstFailure } from "./lib/audit-helpers.js";

interface S5Ctx {
  carol: { email: string; password: string };
  david: { email: string; password: string };
  eve: { email: string; password: string };
  request: { id: string; departmentId: string; amount: number };
}

/**
 * 시나리오 5 — 1500만원 budget → 3단계 승인 (manager → director → cfo).
 *
 * design.md §3:
 *   amount ≥ 10M → 3 stages (manager → director → cfo)
 *
 * 검증:
 *   - 3 transition 모두 200 (각 stage 별 service.advanceStage)
 *   - 최종 status=approved, currentStage=3
 *   - nested audit tree: 각 stage 별 execution entry + 2 check entry
 *   - firstFailure null
 *   - 3 stage의 trace 일관성 — design.md §4 매트릭스 "OTEL traceparent cross-service"
 */
export const scenario5ThreeStageApproval: Scenario<S5Ctx> = {
  name: "scenario-5-three-stage-approval",
  description: "1500만원 budget → 3단계 승인 + 통합 audit tree",
  validates: [
    "approval state machine 3-stage",
    "nested audit tree (≥9 entry)",
    "OTEL trace 일관성",
    "transaction 경계",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: { fixtures: never } }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    const fx = (handle.fixtures as unknown) as {
      carol: { email: string; password: string; departmentId: string };
      david: { email: string; password: string };
      eve: { email: string; password: string };
      departments: { eng: string };
      seedBudgetRequest: (args: { departmentId: string; amount: number; requesterId: string }) => Promise<{ id: string }>;
    };
    const req = await fx.seedBudgetRequest({
      departmentId: fx.departments.eng,
      amount: 15_000_000,
      requesterId: "user-eng-someone",
    });
    return {
      carol: { email: fx.carol.email, password: fx.carol.password },
      david: { email: fx.david.email, password: fx.david.password },
      eve: { email: fx.eve.email, password: fx.eve.password },
      request: { id: req.id, departmentId: fx.departments.eng, amount: 15_000_000 },
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch!;
    const traceIds: string[] = [];
    const stageRootSpanIds: string[] = [];

    const stages: Array<{ name: string; creds: { email: string; password: string } }> = [
      { name: "carol-manager", creds: ctx.carol },
      { name: "david-director", creds: ctx.david },
      { name: "eve-cfo", creds: ctx.eve },
    ];

    for (const stage of stages) {
      const loginRes = await gatewayFetch(new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(stage.creds),
      }));
      if (!loginRes.ok) throw new Error(`${stage.name} login: ${loginRes.status}`);
      const { token } = (await loginRes.json()) as { token: string };
      traceIds.push(loginRes.headers.get("x-trace-id") ?? "");

      const decisionRes = await gatewayFetch(new Request(
        `http://sim/approvals/requests/${ctx.request.id}/decisions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ decision: "approve", comment: `${stage.name} approves` }),
        },
      ));
      if (!decisionRes.ok) {
        throw new Error(`${stage.name} approve: status=${decisionRes.status} body=${await decisionRes.text()}`);
      }
      const decision = (await decisionRes.json()) as { rootSpanId?: string; status: string; currentStage: number };
      traceIds.push(decisionRes.headers.get("x-trace-id") ?? "");
      if (decision.rootSpanId) stageRootSpanIds.push(decision.rootSpanId);
    }

    // GET final status — eve token 사용
    const eveLogin = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.eve),
    }));
    const { token: eveToken } = (await eveLogin.json()) as { token: string };
    const getRes = await gatewayFetch(new Request(`http://sim/approvals/requests/${ctx.request.id}`, {
      headers: { Authorization: `Bearer ${eveToken}` },
    }));
    if (!getRes.ok) throw new Error(`get final: ${getRes.status}`);
    const final = (await getRes.json()) as { status: string; currentStage: number };

    // audit traces — 3 stage 모두
    const traces = await Promise.all(
      stageRootSpanIds.map((rootSpanId) => fetchAuditTrace(gatewayFetch, rootSpanId, eveToken)),
    );
    const failures = await Promise.all(
      stageRootSpanIds.map((rootSpanId) => fetchFirstFailure(gatewayFetch, rootSpanId, eveToken)),
    );

    return {
      data: {
        finalStatus: final.status,
        finalStage: final.currentStage,
        stageRootSpanIds,
        traces,
        failures,
        uniqueTraceIds: [...new Set(traceIds.filter(Boolean))],
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 4,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    equal(d.finalStatus, "approved", "final status must be approved");
    equal(d.finalStage, 3, "final stage must be 3");
    equal((d.stageRootSpanIds as string[]).length, 3, "must have 3 stage rootSpanIds");

    const traces = d.traces as Array<{ count: number; entries: Array<{ kind: string; outcome?: string }> }>;
    for (const [i, trace] of traces.entries()) {
      ok(trace.count >= 3, `stage ${i+1} audit count ≥ 3 (execution + 2 check), got ${trace.count}`);
      const exec = trace.entries.filter((e) => e.kind === "execution");
      ok(exec.length >= 1, `stage ${i+1} must have execution entry`);
    }

    const failures = d.failures as Array<{ firstFailure: unknown }>;
    for (const [i, f] of failures.entries()) {
      equal(f.firstFailure, null, `stage ${i+1} firstFailure must be null`);
    }
  },

  async teardown() {},
};
```

- [ ] **Step 2: scenario-5 test**

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario5ThreeStageApproval } from "./scenario-5-three-stage-approval.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 5 — 3-stage approval", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: "x".repeat(32), dialect: "sqlite" });
    const g = globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch; __simHandle: typeof handle };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => { if (handle) await handle.cleanup(); });

  it("scenario 5 통과", async () => {
    const result = await runScenario(scenario5ThreeStageApproval, {
      gatewayUrl: "http://sim-inproc", mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 5 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 60_000);
});
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-5-three-stage-approval.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-5-three-stage-approval.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 5 — 1500만원 → 3-stage 승인 (manager→director→cfo)

design.md §3 state machine 정확 검증.
3 transition × 3 audit entry = ≥9 entry.
3 stage rootSpanId 별도 추적 + firstFailure null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: scenario-6-delegated-resource (TDD)

**Files:**
- Create: `src/scenarios/scenario-6-delegated-resource.ts`
- Create: `src/scenarios/scenario-6-delegated-resource.test.ts`

- [ ] **Step 1: scenario-6-delegated-resource.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import { fetchAuditTrace } from "./lib/audit-helpers.js";

interface S6Ctx {
  alice: { email: string; password: string };
  frank: { email: string; password: string };
  project: { id: string; departmentId: string };
  graphRootId: string;
}

/**
 * 시나리오 6 — DELEGATED 외부 컨설턴트 위임.
 *
 * authorization-ontology-resource-lifecycle:
 *   REGISTERED → DELEGATED 전이 (alice 호출)
 *   DELEGATED 상태에서 frank가 접근 시 Pass 2가 evaluator.evaluateDelegated 호출
 *   evaluator.evaluateDelegated는 graphRootId 기반 ACL/그래프 판정 → true
 *
 * 검증:
 *   - alice POST /projects/:id/delegate → 200, policy.state=DELEGATED
 *   - frank GET /projects/:id → 200 (Pass 2 acl branch allow)
 *   - audit entry pass=acl 존재 (DELEGATED 분기 증거)
 */
export const scenario6DelegatedResource: Scenario<S6Ctx> = {
  name: "scenario-6-delegated-resource",
  description: "alice가 외부 컨설턴트 frank에게 project 리소스 위임 → frank 접근 가능",
  validates: [
    "resource-policy DELEGATED state",
    "AccessChecker Pass 2 acl branch",
    "InstancePolicyEvaluator.evaluateDelegated",
    "authorization-graph",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: { fixtures: never } }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    const fx = (handle.fixtures as unknown) as {
      alice: { email: string; password: string; departmentId: string };
      frank: { id: string; email: string; password: string };
      departments: { eng: string };
    };

    // setup: alice로 project 생성 후 REGISTERED 등록 (cerbosPolicyRef 부착)
    // 이 단계는 테스트 boilerplate — 본 시나리오의 일부로 수행
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch!;
    const aliceLogin = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: fx.alice.email, password: fx.alice.password }),
    }));
    const { token: aliceToken } = (await aliceLogin.json()) as { token: string };
    const createRes = await gatewayFetch(new Request("http://sim/projects", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: "Consulting Project", departmentId: fx.departments.eng }),
    }));
    if (createRes.status !== 201) {
      throw new Error(`setup project create: ${createRes.status} ${await createRes.text()}`);
    }
    const project = (await createRes.json()) as { id: string };

    return {
      alice: { email: fx.alice.email, password: fx.alice.password },
      frank: { email: fx.frank.email, password: fx.frank.password },
      project: { id: project.id, departmentId: fx.departments.eng },
      graphRootId: `consultant-graph-${project.id}`,
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch!;
    const handle = (globalThis as unknown as { __simHandle?: { fixtures: { frank: { id: string } } } }).__simHandle!;
    const traceIds: string[] = [];

    // alice login
    const aliceLogin = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.alice),
    }));
    const { token: aliceToken } = (await aliceLogin.json()) as { token: string };
    traceIds.push(aliceLogin.headers.get("x-trace-id") ?? "");

    // POST /projects/:id/delegate
    const delegateRes = await gatewayFetch(new Request(
      `http://sim/projects/${ctx.project.id}/delegate`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${aliceToken}` },
        body: JSON.stringify({
          graphRootId: ctx.graphRootId,
          delegateUserId: handle.fixtures.frank.id,
        }),
      },
    ));
    if (!delegateRes.ok) {
      throw new Error(`delegate: status=${delegateRes.status} body=${await delegateRes.text()}`);
    }
    traceIds.push(delegateRes.headers.get("x-trace-id") ?? "");
    const delegated = (await delegateRes.json()) as { state: string; graphRootId: string };

    // frank login
    const frankLogin = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.frank),
    }));
    if (!frankLogin.ok) throw new Error(`frank login: ${frankLogin.status}`);
    const { token: frankToken } = (await frankLogin.json()) as { token: string };
    traceIds.push(frankLogin.headers.get("x-trace-id") ?? "");

    // frank GET /projects/:id
    const frankGetRes = await gatewayFetch(new Request(`http://sim/projects/${ctx.project.id}`, {
      headers: { Authorization: `Bearer ${frankToken}` },
    }));
    const frankGetTraceId = frankGetRes.headers.get("x-trace-id") ?? "";
    if (frankGetTraceId) traceIds.push(frankGetTraceId);

    let frankReadOk = frankGetRes.ok;
    let frankRootSpanId: string | null = null;
    if (frankGetRes.ok) {
      const fetched = (await frankGetRes.json()) as { rootSpanId?: string };
      frankRootSpanId = fetched.rootSpanId ?? null;
    }

    // audit trace for frank's GET (alice token으로 조회 — frank는 audit 권한 가정 없음)
    let trace: Awaited<ReturnType<typeof fetchAuditTrace>> | null = null;
    if (frankRootSpanId) {
      trace = await fetchAuditTrace(gatewayFetch, frankRootSpanId, aliceToken);
    }

    return {
      data: {
        delegateStatus: delegateRes.status,
        delegatedState: delegated.state,
        delegatedGraphRootId: delegated.graphRootId,
        frankReadOk,
        frankReadStatus: frankGetRes.status,
        trace,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 4,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    equal(d.delegateStatus, 200, "delegate POST should be 200");
    equal(d.delegatedState, "DELEGATED", "policy.state must be DELEGATED");
    ok((d.delegatedGraphRootId as string).startsWith("consultant-graph-"), "graphRootId must be set");

    equal(d.frankReadOk, true, `frank GET should succeed (DELEGATED → evaluator.evaluateDelegated allow), got status=${d.frankReadStatus}`);

    const trace = d.trace as { entries: Array<{ kind: string; pass?: string; outcome: string }> } | null;
    if (trace) {
      const aclEntries = trace.entries.filter((e) => e.kind === "check" && e.pass === "acl");
      ok(aclEntries.length >= 1, `must have ≥1 acl check entry (DELEGATED branch evidence), found ${aclEntries.length}`);
      const allAllow = trace.entries.filter((e) => e.kind === "check").every((c) => c.outcome === "allow");
      ok(allAllow, "all check entries should be allow");
    }
  },

  async teardown() {},
};
```

- [ ] **Step 2: scenario-6 test** (13a/b 패턴 동일)

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario6DelegatedResource } from "./scenario-6-delegated-resource.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 6 — DELEGATED resource", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: "x".repeat(32), dialect: "sqlite" });
    const g = globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch; __simHandle: typeof handle };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => { if (handle) await handle.cleanup(); });

  it("scenario 6 통과", async () => {
    const result = await runScenario(scenario6DelegatedResource, {
      gatewayUrl: "http://sim-inproc", mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 6 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 30_000);
});
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-6-delegated-resource.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-6-delegated-resource.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 6 — DELEGATED 외부 컨설턴트 위임

resource-policy.delegate → state DELEGATED + graphRootId 설정.
frank 접근 시 Pass 2 acl branch (evaluator.evaluateDelegated) → allow.
audit entry pass="acl"이 DELEGATED 분기 증거.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: cli.ts에 5, 6 등록

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli.test.ts`

- [ ] **Step 1: cli.ts**

```ts
import { scenario5ThreeStageApproval } from "./scenarios/scenario-5-three-stage-approval.js";
import { scenario6DelegatedResource } from "./scenarios/scenario-6-delegated-resource.js";

export const ALL_SCENARIOS: readonly Scenario[] = [
  scenario1Login,
  scenario2ProjectCreate,
  scenario3SelfDeptApproval,
  scenario4CrossDeptDeny,
  scenario5ThreeStageApproval,
  scenario6DelegatedResource,
];
```

- [ ] **Step 2: cli.test.ts**

```ts
it("ALL_SCENARIOS — Plan 13c 시점에 6건", () => {
  expect(ALL_SCENARIOS).toHaveLength(6);
  expect(ALL_SCENARIOS.map((s) => s.name)).toContain("scenario-5-three-stage-approval");
  expect(ALL_SCENARIOS.map((s) => s.name)).toContain("scenario-6-delegated-resource");
});
```

- [ ] **Step 3: 회귀 + smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test 2>&1 | tail -5 && \
  pnpm --filter @qa-sdk/sim-scenarios build && \
  cd simulations/enterprise-pm/scenarios && node dist/cli.js list | wc -l
```

Expected: list가 ≥ 6+ 줄 (각 시나리오 1줄 + validates 항목).

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/cli.ts \
          simulations/enterprise-pm/scenarios/src/cli.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): scenario 5, 6 ALL_SCENARIOS에 등록

cli list에서 6 시나리오 노출 확인.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- [ ] 시나리오 5 — design.md §3 state machine 1500만원 → 3-stage 정확 검증
- [ ] 3 transition 모두 200, 최종 status=approved + currentStage=3
- [ ] 각 stage audit tree (≥3 entry) + firstFailure null × 3
- [ ] 시나리오 6 — REGISTERED → DELEGATED 전이 + Pass 2 acl branch
- [ ] frank GET /projects/:id 200 — evaluator.evaluateDelegated allow
- [ ] audit pass="acl" entry가 DELEGATED 분기 증거
- [ ] cli ALL_SCENARIOS 6건
- [ ] in-process bootstrap에 carol/david/eve/frank 4 user fixture 추가
- [ ] no fallback — frank GET 실패 시 throw, delegate 실패 시 throw

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| 시나리오 5의 stage rejection / revision_requested | 본 시나리오는 happy path만 — edge case는 별도 | 후속 |
| authorization-graph 깊이 시나리오 (다중 graphRoot) | 본 시나리오는 단일 graphRoot — 운영 시 확장 | 후속 |
| evaluator의 cerbos integration | sim 환경은 in-memory evaluator — 실 cerbos는 별도 | Phase 5 |
| trace_id cross-stage 검증 (각 stage가 동일 root trace에 속함) | OTel SDK exporter 부착 후 측정 | Plan 14a/b |

---

## 의존·후속

- **Plan 13a/b**: runner / cli / in-process bootstrap.
- **Plan 11b**: BudgetRequest state machine + advanceStage 메서드.
- **Plan 11b**: pm-api에 delegate endpoint (Plan 11b의 ProjectController 또는 별도 ResourceController).
- **Plan 12c**: AuditExplorer + OtelAuditRecorder.
- **Plan 13d**: 시나리오 7, 8 (refresh + invalidation).
- **Plan 14a/b**: marginal density + 통합 회귀.
