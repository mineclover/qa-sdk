// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from "vitest";
import {
  transitionGate,
  deriveBundleState,
  isContractDoc,
  deriveGateKinds,
  buildHarnessPlan,
  createHarnessInstance,
  applyGateEvent,
  nextReadyGates,
} from "./harness.js";
import type { DocNode, DocGraphPort, GateState } from "./harness.js";

// ─── 게이트 상태 전이 ──────────────────────────────────

describe("transitionGate", () => {
  it("idle → ready (schedule)", () => {
    expect(transitionGate("idle", { type: "schedule" })).toBe("ready");
  });

  it("idle → blocked (prereqs_blocked)", () => {
    expect(transitionGate("idle", { type: "prereqs_blocked" })).toBe("blocked");
  });

  it("blocked → ready (prereqs_met)", () => {
    expect(transitionGate("blocked", { type: "prereqs_met" })).toBe("ready");
  });

  it("ready → gathering (gather_start)", () => {
    expect(transitionGate("ready", { type: "gather_start" })).toBe("gathering");
  });

  it("gathering → running (gather_done)", () => {
    expect(transitionGate("gathering", { type: "gather_done" })).toBe("running");
  });

  it("gathering → blocked (gather_invalid)", () => {
    expect(transitionGate("gathering", { type: "gather_invalid" })).toBe("blocked");
  });

  it("running → passed (exit 0)", () => {
    expect(transitionGate("running", { type: "exit", code: 0 })).toBe("passed");
  });

  it("running → failed (exit 1)", () => {
    expect(transitionGate("running", { type: "exit", code: 1 })).toBe("failed");
  });

  it("passed → stale (source_changed)", () => {
    expect(transitionGate("passed", { type: "source_changed" })).toBe("stale");
  });

  it("failed → ready (retry)", () => {
    expect(transitionGate("failed", { type: "retry" })).toBe("ready");
  });

  it("stale → ready (retry)", () => {
    expect(transitionGate("stale", { type: "retry" })).toBe("ready");
  });

  it("어떤 상태에서든 skip 가능", () => {
    const states: GateState[] = ["idle", "blocked", "ready", "running", "passed", "failed", "stale"];
    for (const state of states) {
      expect(transitionGate(state, { type: "skip" })).toBe("skipped");
    }
  });

  it("어떤 상태에서든 reset → idle", () => {
    const states: GateState[] = ["blocked", "ready", "running", "passed", "failed", "stale", "skipped"];
    for (const state of states) {
      expect(transitionGate(state, { type: "reset" })).toBe("idle");
    }
  });

  it("유효하지 않은 전이는 현재 상태 유지", () => {
    expect(transitionGate("idle", { type: "exit", code: 0 })).toBe("idle");
    expect(transitionGate("passed", { type: "gather_start" })).toBe("passed");
  });
});

// ─── 번들 상태 파생 ────────────────────────────────────

describe("deriveBundleState", () => {
  it("gate 없으면 empty", () => {
    expect(deriveBundleState([])).toBe("empty");
  });

  it("전부 idle이면 pending", () => {
    expect(deriveBundleState(["idle", "idle"])).toBe("pending");
  });

  it("전부 passed이면 complete", () => {
    expect(deriveBundleState(["passed", "passed"])).toBe("complete");
  });

  it("전부 skipped이면 complete", () => {
    expect(deriveBundleState(["skipped", "skipped"])).toBe("complete");
  });

  it("passed + idle이면 partial", () => {
    expect(deriveBundleState(["passed", "idle"])).toBe("partial");
  });

  it("failed가 있으면 degraded", () => {
    expect(deriveBundleState(["passed", "failed"])).toBe("degraded");
  });

  it("stale가 있으면 degraded", () => {
    expect(deriveBundleState(["passed", "stale"])).toBe("degraded");
  });

  it("gathering이 있으면 gathering", () => {
    expect(deriveBundleState(["gathering", "idle"])).toBe("gathering");
  });
});

// ─── 계약 문서 식별 ────────────────────────────────────

describe("isContractDoc", () => {
  it("interface scope는 계약 문서", () => {
    expect(isContractDoc({ id: "x", level: "leaf", scope: "interface", aspect: "api_contract", depth: "specification" })).toBe(true);
  });

  it("constraint scope는 계약 문서", () => {
    expect(isContractDoc({ id: "x", level: "leaf", scope: "constraint", aspect: "tech_constraint", depth: "specification" })).toBe(true);
  });

  it("feature scope는 계약 문서가 아님", () => {
    expect(isContractDoc({ id: "x", level: "leaf", scope: "feature", aspect: "func_def", depth: "specification" })).toBe(false);
  });
});

// ─── 게이트 유형 도출 ──────────────────────────────────

describe("deriveGateKinds", () => {
  it("api_contract → typecheck + api-contract", () => {
    const kinds = deriveGateKinds({
      id: "x", level: "leaf", scope: "interface", aspect: "api_contract", depth: "specification",
    });
    expect(kinds).toContain("typecheck");
    expect(kinds).toContain("api-contract");
  });

  it("tech_constraint → unit-test + static-analysis", () => {
    const kinds = deriveGateKinds({
      id: "x", level: "leaf", scope: "constraint", aspect: "tech_constraint", depth: "specification",
    });
    expect(kinds).toContain("unit-test");
    expect(kinds).toContain("static-analysis");
  });

  it("security tag → security-audit 추가", () => {
    const kinds = deriveGateKinds({
      id: "x", level: "leaf", scope: "interface", aspect: "api_contract", depth: "specification",
      tags: ["security"],
    });
    expect(kinds).toContain("security-audit");
  });

  it("중복 제거", () => {
    const kinds = deriveGateKinds({
      id: "x", level: "leaf", scope: "constraint", aspect: "tech_constraint", depth: "specification",
    });
    const unique = new Set(kinds);
    expect(kinds.length).toBe(unique.size);
  });
});

// ─── 하네스 계획 ────────────────────────────────────────

function createMockGraph(): DocGraphPort {
  const docs: Record<string, DocNode> = {
    "my-unit": { id: "my-unit", level: "module", scope: "flow", aspect: "process_flow", depth: "overview" },
    "my-contract": { id: "my-contract", level: "leaf", scope: "interface", aspect: "api_contract", depth: "specification" },
    "my-constraint": { id: "my-constraint", level: "leaf", scope: "constraint", aspect: "tech_constraint", depth: "specification", tags: ["security"] },
    "my-feature": { id: "my-feature", level: "leaf", scope: "feature", aspect: "func_def", depth: "specification" },
  };

  const children: Record<string, string[]> = {
    "my-unit": ["my-contract", "my-constraint", "my-feature"],
  };

  return {
    get: (id) => docs[id],
    getChildren: (id) => (children[id] ?? []).map((cid) => docs[cid]).filter(Boolean),
    getConstraints: () => [],
    getDependencies: () => [],
    getOutgoingLinks: () => [],
  };
}

describe("buildHarnessPlan", () => {
  const graph = createMockGraph();

  it("anchor에서 하위 문서를 수집한다", () => {
    const plan = buildHarnessPlan("my-unit", graph);
    expect(plan.anchorId).toBe("my-unit");
    expect(plan.anchorLevel).toBe("module");
    expect(plan.totalDocs).toBe(3);
  });

  it("계약 문서만 식별한다 (interface + constraint)", () => {
    const plan = buildHarnessPlan("my-unit", graph);
    expect(plan.contractDocs).toBe(2); // my-contract + my-constraint
  });

  it("feature 문서에서는 gate를 도출하지 않는다", () => {
    const plan = buildHarnessPlan("my-unit", graph);
    const docIds = plan.requirements.map((r) => r.contractDocId);
    expect(docIds).not.toContain("my-feature");
  });

  it("계약 문서에서 gate requirements를 도출한다", () => {
    const plan = buildHarnessPlan("my-unit", graph);
    expect(plan.requirements.length).toBeGreaterThan(0);
    // api_contract → typecheck + api-contract
    expect(plan.requirements.some((r) => r.gateKind === "typecheck")).toBe(true);
    expect(plan.requirements.some((r) => r.gateKind === "api-contract")).toBe(true);
  });

  it("security tag → security-audit 포함", () => {
    const plan = buildHarnessPlan("my-unit", graph);
    expect(plan.requirements.some((r) => r.gateKind === "security-audit")).toBe(true);
  });

  it("비용 순 정렬 (static 먼저)", () => {
    const plan = buildHarnessPlan("my-unit", graph);
    const scopes = plan.requirements.map((r) => r.gateScope);
    const staticIdx = scopes.indexOf("static");
    const integrationIdx = scopes.indexOf("integration");
    if (staticIdx >= 0 && integrationIdx >= 0) {
      expect(staticIdx).toBeLessThan(integrationIdx);
    }
  });

  it("존재하지 않는 anchor → 빈 계획", () => {
    const plan = buildHarnessPlan("nonexistent", graph);
    expect(plan.totalDocs).toBe(0);
    expect(plan.requirements).toHaveLength(0);
  });
});

// ─── 하네스 인스턴스 ───────────────────────────────────

describe("HarnessInstance", () => {
  it("초기 상태는 전부 idle, 번들은 pending", () => {
    const plan = buildHarnessPlan("my-unit", createMockGraph());
    const instance = createHarnessInstance(plan);
    expect(instance.gates.every((g) => g.state === "idle")).toBe(true);
    expect(instance.bundleState).toBe("pending");
  });

  it("gate 이벤트 적용 후 번들 상태가 재계산된다", () => {
    const plan = buildHarnessPlan("my-unit", createMockGraph());
    let instance = createHarnessInstance(plan);

    // 첫 번째 gate: idle → ready → gathering → running → passed
    instance = applyGateEvent(instance, 0, { type: "schedule" });
    expect(instance.gates[0].state).toBe("ready");

    instance = applyGateEvent(instance, 0, { type: "gather_start" });
    expect(instance.gates[0].state).toBe("gathering");
    expect(instance.bundleState).toBe("gathering");

    instance = applyGateEvent(instance, 0, { type: "gather_done" });
    expect(instance.gates[0].state).toBe("running");

    instance = applyGateEvent(instance, 0, { type: "exit", code: 0 });
    expect(instance.gates[0].state).toBe("passed");
    expect(instance.bundleState).toBe("partial");
  });

  it("전체 gate가 passed되면 complete", () => {
    const plan = buildHarnessPlan("my-unit", createMockGraph());
    let instance = createHarnessInstance(plan);

    for (let i = 0; i < instance.gates.length; i++) {
      instance = applyGateEvent(instance, i, { type: "schedule" });
      instance = applyGateEvent(instance, i, { type: "gather_start" });
      instance = applyGateEvent(instance, i, { type: "gather_done" });
      instance = applyGateEvent(instance, i, { type: "exit", code: 0 });
    }

    expect(instance.bundleState).toBe("complete");
  });

  it("하나라도 failed이면 degraded", () => {
    const plan = buildHarnessPlan("my-unit", createMockGraph());
    let instance = createHarnessInstance(plan);

    // 첫 번째 pass
    instance = applyGateEvent(instance, 0, { type: "schedule" });
    instance = applyGateEvent(instance, 0, { type: "gather_start" });
    instance = applyGateEvent(instance, 0, { type: "gather_done" });
    instance = applyGateEvent(instance, 0, { type: "exit", code: 0 });

    // 두 번째 fail
    instance = applyGateEvent(instance, 1, { type: "schedule" });
    instance = applyGateEvent(instance, 1, { type: "gather_start" });
    instance = applyGateEvent(instance, 1, { type: "gather_done" });
    instance = applyGateEvent(instance, 1, { type: "exit", code: 1 });

    expect(instance.bundleState).toBe("degraded");
  });

  it("nextReadyGates()가 실행 가능한 gate를 반환한다", () => {
    const plan = buildHarnessPlan("my-unit", createMockGraph());
    const instance = createHarnessInstance(plan);
    const ready = nextReadyGates(instance);
    // 초기에는 전부 idle → 전부 반환
    expect(ready.length).toBe(instance.gates.length);
  });
});
