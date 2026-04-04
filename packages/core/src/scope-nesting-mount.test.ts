/**
 * Mount Flow 테스트 — scope↔pipe 브릿지 검증
 */

import { describe, it, expect } from "vitest";
import { validateMountFlow, type MountFlowBinding } from "./scope-nesting-mount.js";
import type { ScopeNesting } from "./scope-nesting.js";
import type { PipeGraph, PipeSpec, PipeFlow } from "./types/pipe-spec.js";

// ── helpers ──────────────────────────────────────────

const step = (facet: string, eventKey?: string): PipeFlow => ({
  kind: "step" as const,
  facet,
  ...(eventKey != null ? { eventKey } : {}),
});

// ── fixtures ─────────────────────────────────────────

const nesting: ScopeNesting = {
  nestingId: "playbook",
  scopes: [
    {
      scopeId: "qa-bridge",
      provides: [{ contractId: "logging-session", type: "logging" }],
      consumes: [],
    },
    {
      scopeId: "feature-context",
      provides: [
        { contractId: "playbook-state", type: "state" },
        { contractId: "persist-adapter", type: "persist" },
      ],
      consumes: [{ contractId: "logging-session", type: "logging" }],
    },
    {
      scopeId: "handlers",
      provides: [{ contractId: "submission-handlers", type: "adapter" }],
      consumes: [
        { contractId: "playbook-state", type: "state" },
        { contractId: "logging-session", type: "logging" },
      ],
    },
    {
      scopeId: "view",
      provides: [],
      consumes: [
        { contractId: "playbook-state", type: "state" },
        { contractId: "submission-handlers", type: "adapter" },
      ],
    },
  ],
};

const graph: PipeGraph = {
  graphId: "handler-graph",
  version: "v1",
  pipes: [
    { pipeId: "validate-input", version: "v1", trigger: { eventKey: "form_submit" }, flow: { kind: "sequence", steps: [step("소비"), step("관리")] }, produces: ["validation_result"] },
    { pipeId: "compute-result", version: "v1", trigger: { eventKey: "validation_result" }, flow: { kind: "sequence", steps: [step("소비"), step("생산")] }, produces: ["review_complete"] },
    { pipeId: "log-event", version: "v1", trigger: { eventKey: "review_complete" }, flow: { kind: "tap", observe: step("소비"), step: step("소비") } },
  ],
  connections: [
    { from: "validate-input", to: "compute-result", kind: "event" },
    { from: "compute-result", to: "log-event", kind: "event" },
  ],
};

// ── 테스트 ───────────────────────────────────────────

describe("validateMountFlow", () => {
  it("정상 바인딩 — 모든 pipe의 계약이 마운트 시점에 활성", () => {
    const binding: MountFlowBinding = {
      nesting,
      graph,
      bindings: {
        "validate-input": { scopeId: "handlers", scopeContracts: ["playbook-state"] },
        "compute-result": { scopeId: "handlers", scopeContracts: ["playbook-state"] },
        "log-event": { scopeId: "handlers", scopeContracts: ["logging-session"] },
      },
    };

    const result = validateMountFlow(binding);
    expect(result.valid).toBe(true);
    expect(result.issues.filter(i => i.severity === "error")).toHaveLength(0);
  });

  it("snapshot — depth별 활성 계약 누적 확인", () => {
    const binding: MountFlowBinding = {
      nesting,
      graph,
      bindings: {
        "validate-input": { scopeId: "handlers", scopeContracts: ["playbook-state"] },
        "compute-result": { scopeId: "handlers", scopeContracts: [] },
        "log-event": { scopeId: "handlers", scopeContracts: [] },
      },
    };

    const result = validateMountFlow(binding);
    // depth 0: logging-session만
    expect(result.snapshots[0].activeContracts).toEqual(["logging-session"]);
    // depth 1: logging + state + persist
    expect(result.snapshots[1].activeContracts).toContain("playbook-state");
    expect(result.snapshots[1].activeContracts).toContain("persist-adapter");
    // depth 2: 전부 + submission-handlers
    expect(result.snapshots[2].activeContracts).toContain("submission-handlers");
    // pipes
    expect(result.snapshots[2].pipes).toEqual(["validate-input", "compute-result", "log-event"]);
  });

  it("contract-unavailable — pipe가 마운트 시점에 없는 계약 소비", () => {
    const binding: MountFlowBinding = {
      nesting,
      graph,
      bindings: {
        // qa-bridge(depth 0)에서 playbook-state 소비 → depth 0에는 logging-session만 있음
        "validate-input": { scopeId: "qa-bridge", scopeContracts: ["playbook-state"] },
        "compute-result": { scopeId: "handlers", scopeContracts: [] },
        "log-event": { scopeId: "handlers", scopeContracts: [] },
      },
    };

    const result = validateMountFlow(binding);
    expect(result.valid).toBe(false);
    const issue = result.issues.find(i => i.code === "contract-unavailable");
    expect(issue).toBeDefined();
    expect(issue!.pipeId).toBe("validate-input");
    expect(issue!.contractId).toBe("playbook-state");
  });

  it("unbound-pipe — binding 없는 pipe는 warning", () => {
    const binding: MountFlowBinding = {
      nesting,
      graph,
      bindings: {
        "validate-input": { scopeId: "handlers", scopeContracts: [] },
        // compute-result, log-event 바인딩 없음
      },
    };

    const result = validateMountFlow(binding);
    // unbound는 warning이므로 valid
    expect(result.valid).toBe(true);
    const unbound = result.issues.filter(i => i.code === "unbound-pipe");
    expect(unbound.length).toBe(2);
  });

  it("scope-not-found — 바인딩의 scopeId가 nesting에 없음", () => {
    const binding: MountFlowBinding = {
      nesting,
      graph,
      bindings: {
        "validate-input": { scopeId: "nonexistent", scopeContracts: [] },
        "compute-result": { scopeId: "handlers", scopeContracts: [] },
        "log-event": { scopeId: "handlers", scopeContracts: [] },
      },
    };

    const result = validateMountFlow(binding);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === "scope-not-found")).toBe(true);
  });

  it("L0 guard — isEncodable false인 계약은 snapshot에서 제외", () => {
    const binding: MountFlowBinding = {
      nesting,
      graph,
      bindings: {
        "validate-input": { scopeId: "handlers", scopeContracts: ["playbook-state"] },
        "compute-result": { scopeId: "handlers", scopeContracts: [] },
        "log-event": { scopeId: "handlers", scopeContracts: ["logging-session"] },
      },
    };

    // logging-session 비활성
    const result = validateMountFlow(binding, {
      isEncodable: (c) => c !== "logging-session",
    });

    expect(result.valid).toBe(false);
    // log-event가 logging-session을 소비 → contract-unavailable
    const issue = result.issues.find(
      i => i.code === "contract-unavailable" && i.pipeId === "log-event",
    );
    expect(issue).toBeDefined();
    // snapshot depth 0에서 logging-session 없음
    expect(result.snapshots[0].activeContracts).not.toContain("logging-session");
  });

  it("view scope에 pipe 바인딩 — 모든 계약 활성", () => {
    const viewPipe: PipeSpec = {
      pipeId: "render-view",
      version: "v1",
      trigger: { eventKey: "state_changed" },
      flow: step("소비"),
    };
    const extGraph: PipeGraph = {
      ...graph,
      pipes: [...graph.pipes, viewPipe],
    };
    const binding: MountFlowBinding = {
      nesting,
      graph: extGraph,
      bindings: {
        "validate-input": { scopeId: "handlers", scopeContracts: [] },
        "compute-result": { scopeId: "handlers", scopeContracts: [] },
        "log-event": { scopeId: "handlers", scopeContracts: [] },
        "render-view": { scopeId: "view", scopeContracts: ["playbook-state", "submission-handlers"] },
      },
    };

    const result = validateMountFlow(binding);
    expect(result.valid).toBe(true);
    expect(result.snapshots[3].pipes).toEqual(["render-view"]);
  });
});
