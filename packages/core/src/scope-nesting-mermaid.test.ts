import { describe, it, expect } from "vitest";
import { nestingToMermaid, mountSnapshotToMermaid, timingToMermaid } from "viz-core";
import { validateScopeNesting, type ScopeNesting } from "./scope-nesting.js";
import { validateMountFlow, type MountFlowBinding } from "./scope-nesting-mount.js";
import { validateContractTiming, type TimedMountFlowBinding } from "./scope-nesting-timing.js";
import { simulate } from "./pipe/pipe-simulate.js";
import type { PipeGraph, PipeFlow } from "./types/pipe-spec.js";

const step = (facet: string, eventKey?: string): PipeFlow => ({
  kind: "step" as const, facet, ...(eventKey != null ? { eventKey } : {}),
});

const nesting: ScopeNesting = {
  nestingId: "playbook",
  scopes: [
    { scopeId: "qa-bridge", provides: [{ contractId: "logging-session", type: "logging" }], consumes: [] },
    { scopeId: "feature-context", provides: [{ contractId: "playbook-state", type: "state" }], consumes: [{ contractId: "logging-session", type: "logging" }] },
    { scopeId: "handlers", provides: [{ contractId: "submission-handlers", type: "adapter" }], consumes: [{ contractId: "playbook-state", type: "state" }, { contractId: "logging-session", type: "logging" }] },
    { scopeId: "view", provides: [], consumes: [{ contractId: "playbook-state", type: "state" }, { contractId: "submission-handlers", type: "adapter" }] },
  ],
};

const graph: PipeGraph = {
  graphId: "g", version: "v1",
  pipes: [
    { pipeId: "validate", version: "v1", trigger: { eventKey: "submit" }, flow: { kind: "sequence", steps: [step("소비"), step("관리")] }, produces: ["result"] },
    { pipeId: "compute", version: "v1", trigger: { eventKey: "result" }, flow: step("생산", "score"), produces: ["done"] },
    { pipeId: "log", version: "v1", trigger: { eventKey: "done" }, flow: { kind: "tap", observe: step("소비", "logged"), step: step("소비") } },
  ],
  connections: [
    { from: "validate", to: "compute", kind: "event" },
    { from: "compute", to: "log", kind: "event" },
  ],
};

describe("nestingToMermaid", () => {
  it("scope 계층 + 계약 하향 다이어그램 생성", () => {
    const validation = validateScopeNesting(nesting);
    const mermaid = nestingToMermaid(nesting, validation);

    expect(mermaid).toContain("flowchart TB");
    // scope 노드
    expect(mermaid).toContain("qa_bridge");
    expect(mermaid).toContain("feature_context");
    expect(mermaid).toContain("handlers");
    expect(mermaid).toContain("view");
    // 계약 하향 엣지
    expect(mermaid).toContain("logging-session");
    expect(mermaid).toContain("playbook-state");
  });

  it("validation 없이도 기본 구조 출력", () => {
    const mermaid = nestingToMermaid(nesting);
    expect(mermaid).toContain("flowchart TB");
    expect(mermaid).toContain("qa_bridge");
  });

  it("error scope에 빨간 스타일 적용", () => {
    // qa-bridge 제거 → feature-context, handlers에서 error
    const broken: ScopeNesting = {
      ...nesting,
      scopes: nesting.scopes.filter(s => s.scopeId !== "qa-bridge"),
    };
    const validation = validateScopeNesting(broken);
    const mermaid = nestingToMermaid(broken, validation);
    expect(mermaid).toContain("fill:#fdd");
  });

  it("optional consume에 ? 표시", () => {
    const optNesting: ScopeNesting = {
      nestingId: "opt",
      scopes: [
        { scopeId: "a", provides: [], consumes: [{ contractId: "x", type: "state", required: false }] },
      ],
    };
    const mermaid = nestingToMermaid(optNesting);
    expect(mermaid).toContain("x?");
  });
});

describe("mountSnapshotToMermaid", () => {
  it("depth별 활성 계약 타임라인 생성", () => {
    const binding: MountFlowBinding = {
      nesting, graph,
      bindings: {
        "validate": { scopeId: "handlers", scopeContracts: ["playbook-state"] },
        "compute": { scopeId: "handlers", scopeContracts: [] },
        "log": { scopeId: "handlers", scopeContracts: [] },
      },
    };
    const result = validateMountFlow(binding);
    const mermaid = mountSnapshotToMermaid(result.snapshots);

    expect(mermaid).toContain("gantt");
    expect(mermaid).toContain("qa-bridge");
    expect(mermaid).toContain("logging-session");
    expect(mermaid).toContain("playbook-state");
    expect(mermaid).toContain("pipes:");
  });
});

describe("timingToMermaid", () => {
  it("readiness + gap을 타임라인으로 생성", () => {
    const asyncNesting: ScopeNesting = {
      nestingId: "async",
      scopes: [
        { scopeId: "ctx", provides: [{ contractId: "state", type: "state", readyAfter: "load_done" }], consumes: [] },
        { scopeId: "handler", provides: [], consumes: [{ contractId: "state", type: "state" }] },
      ],
    };

    const timedGraph: PipeGraph = {
      graphId: "tg", version: "v1",
      pipes: [
        { pipeId: "loader", version: "v1", trigger: { eventKey: "init" }, flow: step("저장", "load_done"), produces: ["load_done"] },
        { pipeId: "submit", version: "v1", trigger: { eventKey: "load_done" }, flow: step("소비"), produces: ["submit_done"] },
      ],
      connections: [{ from: "loader", to: "submit", kind: "event" }],
    };

    const simResult = simulate({ graph: timedGraph, initialEvent: { eventKey: "init" } });
    const binding: TimedMountFlowBinding = {
      nesting: asyncNesting, graph: timedGraph,
      bindings: {
        "loader": { scopeId: "ctx", scopeContracts: [] },
        "submit": { scopeId: "handler", scopeContracts: ["state"] },
      },
    };

    const timing = validateContractTiming(binding, simResult);
    const mermaid = timingToMermaid(timing, simResult.totalSteps);

    expect(mermaid).toContain("gantt");
    expect(mermaid).toContain("Readiness");
    expect(mermaid).toContain("state");
    // ready 이벤트가 있으므로 pending + ready 두 줄
    expect(mermaid).toContain("pending");
    expect(mermaid).toContain("ready");
  });

  it("delegation gap이 있으면 Gap 섹션 포함", () => {
    const gapNesting: ScopeNesting = {
      nestingId: "gap",
      scopes: [
        { scopeId: "ctx", provides: [{ contractId: "s", type: "state" }], consumes: [] },
        { scopeId: "h", provides: [], consumes: [{ contractId: "s", type: "state" }] },
        { scopeId: "v", provides: [], consumes: [{ contractId: "s", type: "state" }] },
      ],
    };

    const gapGraph: PipeGraph = {
      graphId: "gg", version: "v1",
      pipes: [
        { pipeId: "sub", version: "v1", trigger: { eventKey: "go" }, flow: step("생산", "started"), produces: ["started"] },
        { pipeId: "view", version: "v1", trigger: { eventKey: "started" }, flow: step("소비") },
        { pipeId: "persist", version: "v1", trigger: { eventKey: "started" }, flow: step("저장", "done"), produces: ["done"] },
      ],
      connections: [
        { from: "sub", to: "view", kind: "event" },
        { from: "sub", to: "persist", kind: "event" },
      ],
    };

    const sim = simulate({ graph: gapGraph, initialEvent: { eventKey: "go" } });
    const binding: TimedMountFlowBinding = {
      nesting: gapNesting, graph: gapGraph,
      bindings: {
        "sub": { scopeId: "h", scopeContracts: ["s"], delegatesTo: [{ contractId: "s", completionEvent: "done", tolerateStale: true }] },
        "view": { scopeId: "v", scopeContracts: ["s"] },
        "persist": { scopeId: "ctx", scopeContracts: [] },
      },
    };

    const timing = validateContractTiming(binding, sim);
    const mermaid = timingToMermaid(timing, sim.totalSteps);

    expect(mermaid).toContain("Delegation Gaps");
    expect(mermaid).toContain("gap");
  });
});
