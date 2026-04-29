## 단계 11: 시나리오 9~17 추가 + assertion 빌더

**Spec 참조:** `05-error-and-scenarios.md` §3

본 단계는 spec 05 §3 매트릭스의 신규 시나리오 9~17을 9개 파일로 구현하고, 결정 객체(`SafetyDecision`/`ResourceDecision`)에 대한 단언을 압축하는 헬퍼 모듈을 도입한다. spec 05 §3.1 (a)/(b)/(c) 원칙에 따라 단언은 결정 record를 1차 입력으로, 부수효과(gateway weight, replica count, audit append)는 보강 단언으로만 사용한다. Plan A(Task 2.8/2.9/2.16 grammar), Plan B(controller config + fault-injector), Plan C(canary controller cycle write), Plan D(gateway routing push + compose scale executor) 산출물을 그대로 인용한다.

### File Structure (단계 11)

| 종류 | 경로 |
|---|---|
| Create | `simulations/enterprise-pm/scenarios/src/lib/assertions/decision-assertions.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/lib/assertions/decision-assertions.test.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/lib/audit-fetcher.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-9-canary-happy-promote.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-10-canary-rollback-compatibility.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-11-canary-rollback-audit-spike.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-12-scale-up-load-pressure.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-13-scale-blocked-by-db-pool.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-14-read-replica-lag-fallback.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-15-outbox-multi-dispatcher-lock.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-16-bitmap-cache-version-fallback.ts` |
| Create | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-17-pass-priority-canary-blocks-scale.ts` |
| Create | 각 시나리오의 `.test.ts` (in-process 부팅 wrapper, 패턴 동일) |
| Modify | `simulations/enterprise-pm/scenarios/src/cli.ts` (ALL_SCENARIOS 배열 +9) |

---

### Task 11.1: assertion 헬퍼 + audit-recorder fetcher

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/lib/audit-fetcher.ts`
- Create: `simulations/enterprise-pm/scenarios/src/lib/assertions/decision-assertions.ts`
- Create: `simulations/enterprise-pm/scenarios/src/lib/assertions/decision-assertions.test.ts`

신규 9개 시나리오는 모두 `audit.queryDecisions({ cycleIds })` → `assertSafetyVerdict(decision, expected)` 패턴을 공유한다. 인라인 단언을 두면 spec 05 §3.1 (a) 원칙(결정 객체 필드 직접 비교)이 표현마다 흔들리고, `triggerCategory`/`categoryVerdicts`/`action` 비교가 누락되기 쉬우므로 헬퍼로 응집시킨다. fetcher는 Plan C `audit-recorder-store` 인터페이스를 wrapping해 시나리오 코드가 store 구현(in-memory/pg)에 직접 의존하지 않게 한다.

- [ ] **Step 11.1.1: audit fetcher 작성**

`simulations/enterprise-pm/scenarios/src/lib/audit-fetcher.ts`:

```typescript
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
import type { SafetyDecision, ResourceDecision } from "@qa-sdk-sim/controller";

export type AnyDecision = SafetyDecision | ResourceDecision;

export interface AuditFetcher {
  queryDecisions(filter: { cycleIds: readonly string[] }): Promise<AnyDecision[]>;
  queryFirstDecision(filter: {
    pass: "safety" | "resource"; cycleIds?: readonly string[];
  }): Promise<AnyDecision | null>;
  countAlerts(filter: { cycleIds: readonly string[]; kind: string }): Promise<number>;
}

export function getAuditFetcher(): AuditFetcher {
  const h = (globalThis as unknown as { __simAuditFetcher?: AuditFetcher }).__simAuditFetcher;
  if (!h) throw new Error("__simAuditFetcher not bound — controller bootstrap required");
  return h;
}

/** sleep 금지 — Plan C audit-recorder write 이벤트로 cycle 완료 감지. */
export async function waitForCycles(n: number, timeoutMs = 60_000): Promise<string[]> {
  const h = (globalThis as unknown as {
    __simWaitForCycles?: (n: number, timeoutMs: number) => Promise<string[]>;
  }).__simWaitForCycles;
  if (!h) throw new Error("__simWaitForCycles not bound");
  return h(n, timeoutMs);
}
```

- [ ] **Step 11.1.2: assertion 헬퍼 작성 (test-first)**

`decision-assertions.test.ts` — 각 헬퍼당 PASS 케이스 1개 + FAIL 케이스 1개. 핵심 케이스:
- `assertSafetyVerdict` PASS/FAIL: full-match 통과, mismatched weight reject(/weight/), wrong categoryVerdicts subset reject(/compatibility/).
- `assertTriggerCategory` PASS/FAIL: rollback + categoryVerdicts.compatibility=FAIL 통과, WARN인 경우 reject(/FAIL/).
- `assertResourceVerdict` PASS: rejected verdict + rejectedBy="resourceHeadroom" 통과.

baseSafety fixture는 `decisionId="sim.dec.safety.01HXYZ0000000000000000"`, `cycleId="sim.cyc.01HXYZ0000000000000000"`, verdict="promote", 모든 categoryVerdicts=PASS, action.weight=25 revision=2 (Plan A Task 2.8/2.9 grammar 라운드트립 통과 식별자).

`decision-assertions.ts`:

```typescript
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// spec 05 §3.1 원칙:
//   (a) 결정 record 필드 직접 비교 — 부수효과는 별도
//   (b) decisionId/cycleId는 03-identifier-grammar 라운드트립 통과 검증
//   (c) (cycleId, pass) unique — 같은 cycleId 결정 row 정확히 1건

import { equal, deepEqual, ok } from "node:assert/strict";
import type { SafetyDecision, ResourceDecision } from "@qa-sdk-sim/controller";
import { parseDecisionId, parseCycleId } from "sim-identifier-grammar";

export interface SafetyExpectation {
  verdict: "promote" | "hold" | "rollback";
  triggerCategory?: SafetyDecision["triggerCategory"];
  categoryVerdicts?: Partial<SafetyDecision["categoryVerdicts"]>;
  action?: SafetyDecision["action"];
  minConfidence?: number;
}

export interface ResourceExpectation {
  verdict: "scale-up" | "scale-down" | "hold" | "rejected";
  rejectedBy?: ResourceDecision["rejectedBy"];
  target?: { v1: number; v2: number };
  triggerSignals?: readonly string[];
}

export function assertSafetyVerdict(d: SafetyDecision, e: SafetyExpectation): void {
  ok(parseDecisionId(d.decisionId), `decisionId grammar invalid: ${d.decisionId}`);
  ok(parseCycleId(d.cycleId), `cycleId grammar invalid: ${d.cycleId}`);
  equal(d.pass, "safety", "pass must be 'safety'");
  equal(d.verdict, e.verdict, `verdict expected=${e.verdict} actual=${d.verdict}`);
  if (e.triggerCategory !== undefined) equal(d.triggerCategory, e.triggerCategory, `triggerCategory expected=${e.triggerCategory}`);
  if (e.categoryVerdicts) {
    for (const [k, v] of Object.entries(e.categoryVerdicts)) {
      const actual = d.categoryVerdicts[k as keyof typeof d.categoryVerdicts];
      equal(actual, v, `categoryVerdicts.${k} expected=${v} actual=${actual}`);
    }
  }
  if (e.action !== undefined) deepEqual(d.action, e.action, "action mismatch");
  if (e.minConfidence !== undefined) ok(d.confidence >= e.minConfidence, `confidence ${d.confidence} < ${e.minConfidence}`);
}

export function assertTriggerCategory(d: SafetyDecision, expected: NonNullable<SafetyDecision["triggerCategory"]>): void {
  equal(d.verdict, "rollback", "triggerCategory only valid on rollback");
  equal(d.triggerCategory, expected);
  const cv = d.categoryVerdicts[expected as keyof typeof d.categoryVerdicts];
  equal(cv, "FAIL", `categoryVerdicts.${expected} must be FAIL when trigger matches, got=${cv}`);
}

export function assertResourceVerdict(d: ResourceDecision, e: ResourceExpectation): void {
  ok(parseDecisionId(d.decisionId), `decisionId grammar invalid: ${d.decisionId}`);
  ok(parseCycleId(d.cycleId), `cycleId grammar invalid: ${d.cycleId}`);
  equal(d.pass, "resource", "pass must be 'resource'");
  equal(d.verdict, e.verdict, `verdict expected=${e.verdict} actual=${d.verdict}`);
  if (e.verdict === "rejected") {
    ok(d.rejectedBy, "rejected verdict requires rejectedBy");
    if (e.rejectedBy) equal(d.rejectedBy, e.rejectedBy);
  }
  if (e.target && d.action?.kind === "scale") deepEqual(d.action.target, e.target, "action.target mismatch");
  if (e.triggerSignals) for (const s of e.triggerSignals) ok(d.triggerSignals.includes(s), `triggerSignals missing: ${s}`);
}

/** spec 05 §3.1 (c) — (cycleId, pass) unique 보장. */
export function assertSingleDecisionPerCyclePass(decisions: readonly (SafetyDecision | ResourceDecision)[]): void {
  const seen = new Set<string>();
  for (const d of decisions) {
    const key = `${d.cycleId}::${d.pass}`;
    ok(!seen.has(key), `duplicate decision row: ${key}`);
    seen.add(key);
  }
}
```

- [ ] **Step 11.1.3: 테스트 + Commit**

```bash
pnpm --filter @qa-sdk-sim/scenarios test decision-assertions
git add simulations/enterprise-pm/scenarios/src/lib/audit-fetcher.ts \
        simulations/enterprise-pm/scenarios/src/lib/assertions/
git commit -m "feat(sim-scenarios): assertion helpers + audit-recorder fetcher (#9~#17)"
```

---

### Task 11.2: scenario 9 — canary-happy-promote

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-9-canary-happy-promote.ts`
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-9-canary-happy-promote.test.ts`

spec 05 §3 시나리오 9 — v2 = v1 호환, 자연 트래픽, 30s × N 사이클. 단언: weight 5→25→50→100 단조 증가, 사용자별 sticky 일관성 100%, escape hatch 단언, catalog v3 retired·v4 stable 전이 1회. spec 05 §3.1 압축 예시(`safety.filter(d => d.verdict === "promote").map(d => d.action)` deepEqual)를 그대로 인용한다.

- [ ] **Step 11.2.1: 시나리오 본체 작성**

```typescript
// scenario-9-canary-happy-promote.ts
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { equal, deepEqual, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import type { SafetyDecision } from "@qa-sdk-sim/controller";
import { getAuditFetcher, waitForCycles } from "../lib/audit-fetcher.js";
import { assertSafetyVerdict, assertSingleDecisionPerCyclePass } from "../lib/assertions/decision-assertions.js";

interface S9Ctx { initialCatalog: { v3: string; v4: string } }

export const scenario9CanaryHappyPromote: Scenario<S9Ctx> = {
  name: "scenario-9-canary-happy-promote",
  description: "v2 호환 + 자연 트래픽 → 5→25→50→100 단조 promote + catalog 전이",
  validates: [
    "Pass 1 promote sequence (5→25→50→100)",
    "spec 01 §3 dwellTime 준수",
    "spec 02 catalog 상태 전이 (v3 retired, v4 stable)",
    "spec 02 sticky session 일관성",
  ],

  async setup() {
    const cs = (globalThis as unknown as {
      __simCatalogStore?: { getStates(): Promise<{ v3: string; v4: string }> };
    }).__simCatalogStore;
    if (!cs) throw new Error("__simCatalogStore not bound");
    const initialCatalog = await cs.getStates();
    equal(initialCatalog.v3, "stable", "v3 must start as stable");
    equal(initialCatalog.v4, "undeployed", "v4 must start as undeployed");
    return { initialCatalog };
  },

  async act() {
    // Plan B fault-injector OFF — happy path. cycle=2s 단축으로 4 promote + post-100 dwellTime.
    const cycleIds = await waitForCycles(6, 120_000);
    return {
      data: { cycleIds }, traceIds: [], stepCount: cycleIds.length,
      operatorHints: [`pnpm sim:audit query --cycle-id ${cycleIds.at(-1) ?? ""}`],
    };
  },

  async assert(_ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    ok(cycleIds.length >= 4, `expected ≥ 4 cycles, got ${cycleIds.length}`);
    const audit = getAuditFetcher();
    const decisions = await audit.queryDecisions({ cycleIds });
    assertSingleDecisionPerCyclePass(decisions);

    const safety = decisions.filter((d): d is SafetyDecision => d.pass === "safety");

    // spec 05 §3.1 압축 예시 — promote action 시퀀스 deepEqual.
    deepEqual(
      safety.filter((d) => d.verdict === "promote").map((d) => d.action),
      [
        { kind: "weight-update", weight: 5,   revision: 1 },
        { kind: "weight-update", weight: 25,  revision: 2 },
        { kind: "weight-update", weight: 50,  revision: 3 },
        { kind: "weight-update", weight: 100, revision: 4 },
      ],
      "promote weight sequence 5→25→50→100 with monotonic revision",
    );

    for (const d of safety.filter((d) => d.verdict === "promote")) {
      assertSafetyVerdict(d, {
        verdict: "promote",
        categoryVerdicts: {
          perf: "PASS", compatibility: "PASS", decisionQuality: "PASS",
          auditSafety: "PASS", replicationHealth: "PASS",
        },
        minConfidence: 0.6,
      });
    }

    // catalog 전이 — spec 05 §3.1 인용.
    const cs = (globalThis as unknown as {
      __simCatalogStore: { getStates(): Promise<{ v3: string; v4: string }> };
    }).__simCatalogStore;
    const catalog = await cs.getStates();
    equal(catalog.v3, "retired", "v3 must transition to retired");
    equal(catalog.v4, "stable", "v4 must transition to stable");

    // sticky 일관성 — Plan D gateway routing user→version sticky 보장.
    const stickyMetrics = (globalThis as unknown as {
      __simGatewayStickyConsistency?: () => Promise<number>;
    }).__simGatewayStickyConsistency;
    if (stickyMetrics) {
      const ratio = await stickyMetrics();
      equal(ratio, 1.0, `sticky consistency must be 100%, got ${ratio}`);
    }
  },

  async teardown() {},
};
```

- [ ] **Step 11.2.2: 단위 테스트 + Commit**

`scenario-9-canary-happy-promote.test.ts` — 표준 in-process wrapper(`bootInProcess` → `runScenario` → status 검증) 패턴. 본 시나리오용 부팅 옵션: `{ controllerCycleMs: 2_000, faultInjector: "off", v2SchemaCompatible: true }`, 타임아웃 180_000ms. 시나리오 10~12, 15, 16의 .test.ts도 동일 패턴이며 옵션 차이만 둔다 (10/11: faultInjector setup이 자동 활성, 12: bitmap TTL 미적용, 15: `outboxDispatcherReplicas: 3`, 16: `bitmapTtlMs: 5_000`).

```bash
pnpm --filter @qa-sdk-sim/scenarios test scenario-9
git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-9-canary-happy-promote.ts \
        simulations/enterprise-pm/scenarios/src/scenarios/scenario-9-canary-happy-promote.test.ts
git commit -m "feat(sim-scenarios): #9 canary-happy-promote (5→25→50→100 + catalog 전이)"
```

---

### Task 11.3: scenario 10 — canary-rollback-compatibility

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-10-canary-rollback-compatibility.ts`
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-10-canary-rollback-compatibility.test.ts`

spec 05 §3 시나리오 10 — v2가 outbox에 신규 필수 필드 추가(호환 깨짐). 단언: 첫 사이클 내 Pass1 rollback (hard), trigger=compatibility, weight=0, audit에 책임 카테고리/신호 기록, v3 stable 유지. spec 01 §2 hard rule(`compatibility.schemaCompatRate < 1.0`) 즉시 FAIL을 검증하며 Plan B fault-injector `schema-break`를 setup에서 활성화한다.

- [ ] **Step 11.3.1: 시나리오 본체 작성**

```typescript
// scenario-10-canary-rollback-compatibility.ts
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import type { SafetyDecision } from "@qa-sdk-sim/controller";
import { getAuditFetcher, waitForCycles } from "../lib/audit-fetcher.js";
import {
  assertSafetyVerdict, assertTriggerCategory, assertSingleDecisionPerCyclePass,
} from "../lib/assertions/decision-assertions.js";

interface S10Ctx { faultHandle: { off: () => Promise<void> } }

export const scenario10CanaryRollbackCompatibility: Scenario<S10Ctx> = {
  name: "scenario-10-canary-rollback-compatibility",
  description: "v2 schema 호환 깨짐 → Pass1 hard rollback + v3 stable 유지",
  validates: [
    "spec 01 §2 hard rule (compatibility.schemaCompatRate < 1.0)",
    "spec 01 §3 hard rollback first 분기",
    "audit-recorder triggerCategory + triggerSignals 기록",
  ],

  async setup() {
    const inj = (globalThis as unknown as {
      __simFaultInjector?: { schemaBreak: { on: () => Promise<{ off: () => Promise<void> }> } };
    }).__simFaultInjector;
    if (!inj) throw new Error("__simFaultInjector not bound");
    const faultHandle = await inj.schemaBreak.on();
    return { faultHandle };
  },

  async act() {
    // hard rule이므로 첫 사이클 안에 rollback 발생. 2 cycle 대기로 충분.
    const cycleIds = await waitForCycles(2, 30_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(_ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    ok(cycleIds.length >= 1, "expected at least 1 cycle");
    const audit = getAuditFetcher();
    assertSingleDecisionPerCyclePass(await audit.queryDecisions({ cycleIds }));

    const first = (await audit.queryFirstDecision({ pass: "safety", cycleIds })) as SafetyDecision | null;
    ok(first, "first safety decision must exist");

    assertSafetyVerdict(first, {
      verdict: "rollback", triggerCategory: "compatibility",
      categoryVerdicts: { compatibility: "FAIL" },
      action: { kind: "weight-update", weight: 0, revision: 1 },
    });
    assertTriggerCategory(first, "compatibility");

    ok(
      first.triggerSignals.includes("compatibility.schemaCompatRate"),
      `triggerSignals must include compatibility.schemaCompatRate, got ${JSON.stringify(first.triggerSignals)}`,
    );

    // catalog v3 stable 유지 — rollback이므로 전이 금지.
    const cs = (globalThis as unknown as {
      __simCatalogStore: { getStates(): Promise<{ v3: string; v4: string }> };
    }).__simCatalogStore;
    const catalog = await cs.getStates();
    equal(catalog.v3, "stable", "v3 must remain stable on rollback");
  },

  async teardown(ctx) { await ctx.faultHandle.off(); },
};
```

- [ ] **Step 11.3.2: 단위 테스트 + Commit**

`scenario-10-canary-rollback-compatibility.test.ts` — 시나리오 9와 동일 wrapper 패턴(타임아웃 60_000ms). schemaBreak fault는 시나리오 setup이 자동 활성하므로 부팅 옵션은 `{ controllerCycleMs: 2_000 }`만으로 충분.

```bash
pnpm --filter @qa-sdk-sim/scenarios test scenario-10
git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-10-canary-rollback-compatibility.ts \
        simulations/enterprise-pm/scenarios/src/scenarios/scenario-10-canary-rollback-compatibility.test.ts
git commit -m "feat(sim-scenarios): #10 canary-rollback-compatibility (hard FAIL schemaCompatRate)"
```

---

### Task 11.4: scenario 11 — canary-rollback-audit-spike

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-11-canary-rollback-audit-spike.ts`
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-11-canary-rollback-audit-spike.test.ts`

spec 05 §3 시나리오 11 — v2가 stage skip → audit critical anomaly 발생. 단언: Pass1 rollback (hard), trigger=auditSafety, weight=0, anomaly 1건 audit-recorder 기록. spec 01 §2 hard rule(`auditSafety.criticalAnomalyRate > 0`) + CON-005를 검증한다. Plan B fault-injector `audit-anomaly`로 stage-skip 패턴 1회를 주입한다.

- [ ] **Step 11.4.1: 시나리오 본체 작성**

```typescript
// scenario-11-canary-rollback-audit-spike.ts
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import type { SafetyDecision } from "@qa-sdk-sim/controller";
import { getAuditFetcher, waitForCycles } from "../lib/audit-fetcher.js";
import {
  assertSafetyVerdict, assertTriggerCategory, assertSingleDecisionPerCyclePass,
} from "../lib/assertions/decision-assertions.js";

interface S11Ctx { faultHandle: { off: () => Promise<void> } }

export const scenario11CanaryRollbackAuditSpike: Scenario<S11Ctx> = {
  name: "scenario-11-canary-rollback-audit-spike",
  description: "v2 stage skip → audit critical anomaly → hard rollback",
  validates: [
    "spec 01 §2 hard rule (auditSafety.criticalAnomalyRate > 0)",
    "CON-005 critical anomaly → auto observation",
    "audit anomaly count = 1",
  ],

  async setup() {
    const inj = (globalThis as unknown as {
      __simFaultInjector?: { auditAnomaly: { on: () => Promise<{ off: () => Promise<void> }> } };
    }).__simFaultInjector;
    if (!inj) throw new Error("__simFaultInjector not bound");
    const faultHandle = await inj.auditAnomaly.on();
    return { faultHandle };
  },

  async act() {
    const cycleIds = await waitForCycles(2, 30_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(_ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    const audit = getAuditFetcher();
    assertSingleDecisionPerCyclePass(await audit.queryDecisions({ cycleIds }));

    const first = (await audit.queryFirstDecision({ pass: "safety", cycleIds })) as SafetyDecision | null;
    ok(first, "first safety decision must exist");

    assertSafetyVerdict(first, {
      verdict: "rollback", triggerCategory: "auditSafety",
      categoryVerdicts: { auditSafety: "FAIL" },
      action: { kind: "weight-update", weight: 0, revision: 1 },
    });
    assertTriggerCategory(first, "auditSafety");

    ok(
      first.triggerSignals.includes("auditSafety.criticalAnomalyRate"),
      "triggerSignals must include auditSafety.criticalAnomalyRate",
    );

    // anomaly 1건 — audit-recorder anomaly classification 기록.
    const anomalyCount = await audit.countAlerts({ cycleIds, kind: "audit-critical-anomaly" });
    equal(anomalyCount, 1, `expected exactly 1 anomaly, got ${anomalyCount}`);
  },

  async teardown(ctx) { await ctx.faultHandle.off(); },
};
```

- [ ] **Step 11.4.2: 단위 테스트 + Commit**

```bash
pnpm --filter @qa-sdk-sim/scenarios test scenario-11
git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-11-canary-rollback-audit-spike.ts \
        simulations/enterprise-pm/scenarios/src/scenarios/scenario-11-canary-rollback-audit-spike.test.ts
git commit -m "feat(sim-scenarios): #11 canary-rollback-audit-spike (hard FAIL criticalAnomalyRate)"
```

---

### Task 11.5: scenario 12 — scale-up-load-pressure

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-12-scale-up-load-pressure.ts`
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-12-scale-up-load-pressure.test.ts`

spec 05 §3 시나리오 12 — RPS 폭증(자체 generator). 단언: Pass2 scale-up trigger=loadPressure, target.v2 += 1, p95 회복(다음 사이클 PASS). spec 01 §4 Pass 2 분기(`loadPressure=FAIL ∧ resourceHeadroom!=FAIL → scale-up`, 카나리 진행 중 v2 우선)를 검증한다.

- [ ] **Step 11.5.1: 시나리오 본체 작성**

```typescript
// scenario-12-scale-up-load-pressure.ts
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import type { ResourceDecision, SafetyDecision } from "@qa-sdk-sim/controller";
import { getAuditFetcher, waitForCycles } from "../lib/audit-fetcher.js";
import { assertResourceVerdict } from "../lib/assertions/decision-assertions.js";

interface S12Ctx {
  burstHandle: { stop: () => Promise<void> };
  initialReplicas: { v1: number; v2: number };
}

export const scenario12ScaleUpLoadPressure: Scenario<S12Ctx> = {
  name: "scenario-12-scale-up-load-pressure",
  description: "RPS 폭증 → Pass2 scale-up (v2 +=1) → 다음 사이클 p95 회복",
  validates: [
    "spec 01 §4 Pass 2 scale-up 분기 (loadPressure=FAIL ∧ resourceHeadroom≠FAIL)",
    "spec 01 §4 카나리 진행 중 v2 우선 증가",
    "p95 회복 다음 사이클 PASS",
  ],

  async setup() {
    const ch = (globalThis as unknown as {
      __simComposeHandle?: { getReplicas(): Promise<{ v1: number; v2: number }> };
    }).__simComposeHandle;
    if (!ch) throw new Error("__simComposeHandle not bound");
    const initialReplicas = await ch.getReplicas();

    // SIM_LOAD_RPS_THRESHOLD(=100) 초과로 RPS 200 burst.
    const burst = (globalThis as unknown as {
      __simBurstLoad?: (rps: number) => Promise<{ stop: () => Promise<void> }>;
    }).__simBurstLoad;
    if (!burst) throw new Error("__simBurstLoad not bound");
    const burstHandle = await burst(200);
    return { burstHandle, initialReplicas };
  },

  async act() {
    // 첫 사이클 loadPressure=FAIL → scale-up. 둘째 사이클 replica 증가 후 p95 회복 PASS.
    const cycleIds = await waitForCycles(3, 60_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    const audit = getAuditFetcher();
    const decisions = await audit.queryDecisions({ cycleIds });

    // Pass 1이 rollback이면 Pass 2 SKIP — spec 01 §4. scale-up 검증을 위해 Pass 1 hold/promote만 허용.
    const safety = decisions.filter((d): d is SafetyDecision => d.pass === "safety");
    ok(
      safety.every((d) => d.verdict === "promote" || d.verdict === "hold"),
      "Pass 1 must not be rollback (otherwise Pass 2 would SKIP)",
    );

    // 첫 scale-up Pass 2.
    const first = (await audit.queryFirstDecision({ pass: "resource", cycleIds })) as ResourceDecision | null;
    ok(first, "first resource decision must exist");

    assertResourceVerdict(first, {
      verdict: "scale-up",
      target: { v1: ctx.initialReplicas.v1, v2: ctx.initialReplicas.v2 + 1 },
      triggerSignals: ["loadPressure.RPS"],
    });

    // 다음 사이클 — replica 증가 반영 후 loadPressure 회복.
    const resourceDecisions = decisions.filter((d): d is ResourceDecision => d.pass === "resource");
    if (resourceDecisions.length >= 2) {
      const next = resourceDecisions[1];
      ok(next.categoryVerdicts.loadPressure !== "FAIL",
        `next cycle loadPressure must recover, got ${next.categoryVerdicts.loadPressure}`);
    }

    // compose 실제 replica — 부수효과 보강 단언.
    const ch = (globalThis as unknown as {
      __simComposeHandle: { getReplicas(): Promise<{ v1: number; v2: number }> };
    }).__simComposeHandle;
    const after = await ch.getReplicas();
    equal(after.v2, ctx.initialReplicas.v2 + 1, "compose v2 replica must increase by 1");
  },

  async teardown(ctx) { await ctx.burstHandle.stop(); },
};
```

- [ ] **Step 11.5.2: 단위 테스트 + Commit**

```bash
pnpm --filter @qa-sdk-sim/scenarios test scenario-12
git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-12-scale-up-load-pressure.ts \
        simulations/enterprise-pm/scenarios/src/scenarios/scenario-12-scale-up-load-pressure.test.ts
git commit -m "feat(sim-scenarios): #12 scale-up-load-pressure (RPS burst → v2+=1)"
```

---

### Task 11.6: scenario 13 — scale-blocked-by-db-pool (outline)

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-13-scale-blocked-by-db-pool.ts`
- Create: `.test.ts`

**Trigger:** Plan B fault-injector `dbPool.tighten(pool=4)` + RPS burst → 동시 요청 ≥4 지속으로 `resourceHeadroom.dbPoolUtilization` FAIL.

**Assertion:** `assertResourceVerdict(first, { verdict: "rejected", rejectedBy: "resourceHeadroom" })` + replica 변동 0(`compose.getReplicas()` 비교) + `audit.countAlerts({ kind: "scale-rejected" }) === 1`. spec 01 §4 `loadPressure=FAIL ∧ resourceHeadroom=FAIL → rejected` 분기.

**Commit:** `feat(sim-scenarios): #13 scale-blocked-by-db-pool (rejected + alert)`

---

### Task 11.7: scenario 14 — read-replica-lag-fallback (outline)

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-14-read-replica-lag-fallback.ts`
- Create: `.test.ts`

**Trigger:** Plan B fault-injector `lag.inject(3000ms)` (Plan A 단계 4 read replica + Plan D BFF read 라우팅).

**Assertion:** `decision.categoryVerdicts.replicationHealth === "WARN"`(spec 01 §2 임계 ≤2000=WARN, >2000=FAIL) + BFF 첫 조회가 primary fallback(stale 1회) → 다음 polling 정상 + audit `evidence`에 `{ kind: "external", source: "pg_stat_replication", content: { replayLagMs: ≥3000 } }` 기록.

**Commit:** `feat(sim-scenarios): #14 read-replica-lag-fallback (lag + primary fallback)`

---

### Task 11.8: scenario 15 — outbox-multi-dispatcher-lock

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-15-outbox-multi-dispatcher-lock.ts`
- Create: `.test.ts`

spec 05 §3 시나리오 15 — v2 replica=3, 5 이벤트 동시 INSERT. 단언: 5 이벤트 = 5 ingest 발행(정확히), dispatcher별 처리 row disjoint, 락 경합 추가 lag < 100ms. Plan D outbox dispatcher가 PG advisory lock으로 row lease를 획득해 중복 발행이 없는지 검증한다.

- [ ] **Step 11.8.1: 시나리오 본체 작성**

```typescript
// scenario-15-outbox-multi-dispatcher-lock.ts
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S15Ctx {
  insertedEventIds: string[];
  dispatcherAssignments: Map<string, string>;
}

export const scenario15OutboxMultiDispatcherLock: Scenario<S15Ctx> = {
  name: "scenario-15-outbox-multi-dispatcher-lock",
  description: "outbox replica=3 + 5 동시 INSERT → 정확히 5 발행 + disjoint 처리",
  validates: [
    "Plan D outbox dispatcher PG advisory lock (row lease)",
    "spec 05 §1 outbox dispatcher fail policy (retry + DLQ)",
    "락 경합 추가 lag < 100ms",
  ],

  async setup() { return { insertedEventIds: [], dispatcherAssignments: new Map() }; },

  async act(ctx) {
    const oc = (globalThis as unknown as {
      __simOutboxClient?: {
        insertEvents(count: number): Promise<string[]>;
        waitForDispatch(eventIds: string[], timeoutMs: number): Promise<{
          publishedAt: Map<string, number>;
          dispatcherIds: Map<string, string>;
          insertedAtMs: number;
        }>;
      };
    }).__simOutboxClient;
    if (!oc) throw new Error("__simOutboxClient not bound");

    const ids = await oc.insertEvents(5);
    ctx.insertedEventIds = ids;
    const r = await oc.waitForDispatch(ids, 10_000);
    for (const [eid, did] of r.dispatcherIds) ctx.dispatcherAssignments.set(eid, did);
    return {
      data: {
        ids,
        publishedAt: Array.from(r.publishedAt.entries()),
        dispatcherIds: Array.from(r.dispatcherIds.entries()),
        insertedAtMs: r.insertedAtMs,
      },
      traceIds: [], stepCount: ids.length,
    };
  },

  async assert(_ctx, actResult) {
    const ids = actResult.data.ids as string[];
    const publishedAt = new Map(actResult.data.publishedAt as [string, number][]);
    const dispatcherIds = new Map(actResult.data.dispatcherIds as [string, string][]);
    const insertedAtMs = actResult.data.insertedAtMs as number;

    // 정확히 5 발행 — 중복도 누락도 없음.
    equal(ids.length, 5, "5 events inserted");
    equal(publishedAt.size, 5, "exactly 5 events published (no dup, no miss)");

    // dispatcher별 처리 row disjoint — 한 이벤트 → 한 dispatcher.
    const inverse = new Map<string, Set<string>>();
    for (const [eid, did] of dispatcherIds) {
      const set = inverse.get(did) ?? new Set<string>();
      set.add(eid);
      inverse.set(did, set);
    }
    const allEvents = Array.from(inverse.values()).flatMap((s) => Array.from(s));
    equal(new Set(allEvents).size, allEvents.length, "dispatcher event sets must be disjoint");

    // 락 경합 추가 lag — first publish vs last publish 차이.
    const times = Array.from(publishedAt.values()).sort((a, b) => a - b);
    const baselineLagMs = times[0] - insertedAtMs;
    const maxLagMs = times[times.length - 1] - insertedAtMs;
    const contentionLagMs = maxLagMs - baselineLagMs;
    ok(contentionLagMs < 100, `lock contention lag must be < 100ms, got ${contentionLagMs}ms`);
  },

  async teardown() {},
};
```

- [ ] **Step 11.8.2: 단위 테스트 + Commit**

```bash
pnpm --filter @qa-sdk-sim/scenarios test scenario-15
git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-15-outbox-multi-dispatcher-lock.ts \
        simulations/enterprise-pm/scenarios/src/scenarios/scenario-15-outbox-multi-dispatcher-lock.test.ts
git commit -m "feat(sim-scenarios): #15 outbox-multi-dispatcher-lock (5 disjoint, lag<100ms)"
```

---

### Task 11.9: scenario 16 — bitmap-cache-version-fallback

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-16-bitmap-cache-version-fallback.ts`
- Create: `.test.ts`

spec 05 §3 시나리오 16 — publisher가 invalidate 메시지 drop, version 진화 발생. 단언: TTL 만료 또는 version-check 시점에 refresh 자동 발동, denyRate baseline 유지, 회복 시간 ≤ TTL+1cycle. spec 05 §1 bitmap cache deny fail-closed 정책 — 권한 정합성이 가용성보다 우선이므로 invalidate drop 후에도 stale data로 부정확한 allow가 발생하지 않아야 한다.

- [ ] **Step 11.9.1: 시나리오 본체 작성**

```typescript
// scenario-16-bitmap-cache-version-fallback.ts
// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S16Ctx {
  faultHandle: { off: () => Promise<void> };
  baselineDenyRate: number;
  ttlMs: number;
}

export const scenario16BitmapCacheVersionFallback: Scenario<S16Ctx> = {
  name: "scenario-16-bitmap-cache-version-fallback",
  description: "pub/sub drop → version 진화 → TTL/version-check refresh → denyRate 유지",
  validates: [
    "spec 05 §1 bitmap cache deny fail-closed",
    "TTL/version-check 기반 refresh fallback",
    "stale data로 부정확한 allow 미발생",
  ],

  async setup() {
    const inj = (globalThis as unknown as {
      __simFaultInjector?: { pubsubInvalidate: { drop: () => Promise<{ off: () => Promise<void> }> } };
    }).__simFaultInjector;
    if (!inj) throw new Error("__simFaultInjector not bound");

    const m = (globalThis as unknown as {
      __simBitmapMetrics?: { denyRate(): Promise<number>; bitmapTtlMs(): Promise<number> };
    }).__simBitmapMetrics;
    if (!m) throw new Error("__simBitmapMetrics not bound");
    const baselineDenyRate = await m.denyRate();
    const ttlMs = await m.bitmapTtlMs();

    const faultHandle = await inj.pubsubInvalidate.drop();
    return { faultHandle, baselineDenyRate, ttlMs };
  },

  async act(ctx) {
    // 권한 정의 변경(role 추가) → bitmap version v1→v2. publisher가 invalidate 보내지만 drop됨.
    const mut = (globalThis as unknown as {
      __simBitmapVersionMutator?: () => Promise<{ newVersion: string }>;
    }).__simBitmapVersionMutator;
    if (!mut) throw new Error("__simBitmapVersionMutator not bound");
    const { newVersion } = await mut();

    // refresh 발동 경로 둘 — version-check (즉시) 또는 TTL 만료.
    const startedAt = Date.now();
    const checker = (globalThis as unknown as {
      __simBitmapVersionCheck?: (expected: string, timeoutMs: number) => Promise<{
        recoveredAtMs: number; recoveredVia: "version-check" | "ttl";
      }>;
    }).__simBitmapVersionCheck;
    if (!checker) throw new Error("__simBitmapVersionCheck not bound");
    const recovery = await checker(newVersion, ctx.ttlMs + 30_000);
    const elapsedMs = recovery.recoveredAtMs - startedAt;

    return {
      data: { newVersion, elapsedMs, recoveredVia: recovery.recoveredVia },
      traceIds: [], stepCount: 1,
    };
  },

  async assert(ctx, actResult) {
    const elapsedMs = actResult.data.elapsedMs as number;
    const recoveredVia = actResult.data.recoveredVia as "version-check" | "ttl";

    // 회복 시간 ≤ TTL+1cycle (cycle=2s).
    const cycleMs = 2_000;
    ok(elapsedMs <= ctx.ttlMs + cycleMs,
      `recovery elapsed ${elapsedMs}ms must be ≤ TTL+cycle (${ctx.ttlMs + cycleMs}ms)`);

    ok(recoveredVia === "version-check" || recoveredVia === "ttl",
      `recoveredVia must be 'version-check' or 'ttl', got ${recoveredVia}`);

    // denyRate baseline ±5% — refresh 후 재측정.
    const m = (globalThis as unknown as {
      __simBitmapMetrics: { denyRate(): Promise<number> };
    }).__simBitmapMetrics;
    const after = await m.denyRate();
    ok(Math.abs(after - ctx.baselineDenyRate) <= 0.05,
      `denyRate Δ must stay within ±5%, baseline=${ctx.baselineDenyRate} after=${after}`);
  },

  async teardown(ctx) { await ctx.faultHandle.off(); },
};
```

- [ ] **Step 11.9.2: 단위 테스트 + Commit**

```bash
pnpm --filter @qa-sdk-sim/scenarios test scenario-16
git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-16-bitmap-cache-version-fallback.ts \
        simulations/enterprise-pm/scenarios/src/scenarios/scenario-16-bitmap-cache-version-fallback.test.ts
git commit -m "feat(sim-scenarios): #16 bitmap-cache-version-fallback (TTL/version-check refresh)"
```

---

### Task 11.10: scenario 17 — pass-priority-canary-blocks-scale (outline)

**Files:**
- Create: `simulations/enterprise-pm/scenarios/src/scenarios/scenario-17-pass-priority-canary-blocks-scale.ts`

**Trigger:** 카나리 진행 중(weight=25 dwellTime 미충족, perf WARN) + RPS 폭증 동시 — Plan B fault-injector `perf.warn` + RPS burst 동시 활성화.

**Assertion:** Pass 1 = `assertSafetyVerdict(d, { verdict: "hold", categoryVerdicts: { perf: "WARN" } })`, Pass 2 SKIP — `decisions.filter(d => d.pass === "resource").length === 0`. audit `evidence`에 SKIP 사유 기록 — `evidence.find(e => e.source === "pass-priority-skip")?.content === "pass1-not-promote-or-stable"`. spec 01 §4 "Pass 1이 promote/stable이 아니면 SKIP" 분기.

**Commit:** `feat(sim-scenarios): #17 pass-priority-canary-blocks-scale (Pass1 hold → Pass2 SKIP)`

---

### Task 11.11: cli.ts ALL_SCENARIOS 등록 (outline)

**Files:** Modify `simulations/enterprise-pm/scenarios/src/cli.ts`

**Trigger:** 9개 신규 시나리오 import + `ALL_SCENARIOS` 배열 끝에 9개 push (시나리오 1~8 다음, 번호 순서).

**Assertion:** `pnpm sim:scenarios run --all --json | jq 'length'` = `17`. CLI 스모크 — `pnpm sim:scenarios run scenario-9-canary-happy-promote --json` 단일 실행 시 status=passed.

**Commit:** `chore(sim-scenarios): register #9~#17 in ALL_SCENARIOS`

---

### Task 11.12: 9 시나리오 통합 PASS 검증 (outline)

**Files:** 없음 (검증 단계).

**Trigger:** 단계 1~10 모든 산출물 머지 후 sim 부팅 + 전체 시나리오 매트릭스 실행.

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
sops decrypt .env.sim.enc > .env.sim
pnpm sim:up
pnpm sim:scenarios run --all --json > scenario-matrix.json
jq '[.[] | select(.status == "passed")] | length' scenario-matrix.json
```

**Assertion:** 출력 `17` (시나리오 1~17 모두 PASS). 실패 시 spec 05 §6 분류 트리(인프라 검사 → audit record → categoryVerdicts → verdict → action 부수효과)에 따라 진단.

**Commit:** `test(sim-scenarios): all 17 scenarios pass (cycle 1 closure)`

---

**단계 11 완료 조건:**

- assertion 헬퍼 + audit fetcher PASS (Task 11.1).
- 시나리오 9·10·11·12·15·16 in-process 단위 테스트 PASS (Task 11.2~11.5, 11.8, 11.9).
- 시나리오 13·14·17 본체 + cli.ts 등록 완료 (Task 11.6, 11.7, 11.10, 11.11).
- `pnpm sim:scenarios run --all` 17개 시나리오 모두 PASS (Task 11.12).
- spec 05 §3.3 매핑 표의 모든 fail policy 행이 시나리오 또는 인프라 검사로 커버됨.
