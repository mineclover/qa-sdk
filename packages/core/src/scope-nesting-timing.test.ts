/**
 * Contract Timing 테스트 — 계약 위임 시점 분석
 */

import { describe, it, expect } from "vitest";
import { validateContractTiming, type TimedMountFlowBinding } from "./scope-nesting-timing.js";
import { simulate } from "./pipe/pipe-simulate.js";
import type { ScopeNesting } from "./scope-nesting.js";
import type { PipeGraph, PipeFlow } from "./types/pipe-spec.js";

// ── helpers ──────────────────────────────────────────

const step = (facet: string, eventKey?: string): PipeFlow => ({
  kind: "step" as const,
  facet,
  ...(eventKey != null ? { eventKey } : {}),
});

// ── fixtures ─────────────────────────────────────────

/** 비동기 초기화가 있는 nesting */
const asyncNesting: ScopeNesting = {
  nestingId: "async-playbook",
  scopes: [
    {
      scopeId: "qa-bridge",
      provides: [{ contractId: "logging-session", type: "logging" }],
      consumes: [],
    },
    {
      scopeId: "feature-context",
      provides: [
        {
          contractId: "playbook-state", type: "state",
          readyAfter: "persist_load_complete",
        },
      ],
      consumes: [],
    },
    {
      scopeId: "handlers",
      provides: [{ contractId: "submission-handlers", type: "adapter" }],
      consumes: [{ contractId: "playbook-state", type: "state" }],
    },
  ],
};

/** persist load가 submit 이후에 완료되는 graph */
const lateLoadGraph: PipeGraph = {
  graphId: "late-load",
  version: "v1",
  pipes: [
    {
      pipeId: "submit-handler",
      version: "v1",
      trigger: { eventKey: "form_submit" },
      flow: { kind: "sequence", steps: [step("소비"), step("관리")] },
      produces: ["validation_result"],
    },
    {
      pipeId: "persist-loader",
      version: "v1",
      trigger: { eventKey: "validation_result" },
      flow: step("저장", "persist_load_complete"),
      produces: ["persist_load_complete"],
    },
  ],
  connections: [
    { from: "submit-handler", to: "persist-loader", kind: "event" },
  ],
};

/** persist load가 submit 이전에 완료되는 graph */
const earlyLoadGraph: PipeGraph = {
  graphId: "early-load",
  version: "v1",
  pipes: [
    {
      pipeId: "persist-loader",
      version: "v1",
      trigger: { eventKey: "app_init" },
      flow: step("저장", "persist_load_complete"),
      produces: ["persist_load_complete"],
    },
    {
      pipeId: "submit-handler",
      version: "v1",
      trigger: { eventKey: "persist_load_complete" },
      flow: { kind: "sequence", steps: [step("소비"), step("관리")] },
      produces: ["validation_result"],
    },
  ],
  connections: [
    { from: "persist-loader", to: "submit-handler", kind: "event" },
  ],
};

// ── readyAfter 테스트 ────────────────────────────────

describe("consume-before-ready", () => {
  it("submit이 persist load 전에 실행 — consume-before-ready error", () => {
    const simResult = simulate({
      graph: lateLoadGraph,
      initialEvent: { eventKey: "form_submit" },
    });

    const binding: TimedMountFlowBinding = {
      nesting: asyncNesting,
      graph: lateLoadGraph,
      bindings: {
        "submit-handler": {
          scopeId: "handlers",
          scopeContracts: ["playbook-state"],
        },
        "persist-loader": {
          scopeId: "feature-context",
          scopeContracts: [],
        },
      },
    };

    const result = validateContractTiming(binding, simResult);
    expect(result.valid).toBe(false);
    const issue = result.issues.find(i => i.code === "consume-before-ready");
    expect(issue).toBeDefined();
    expect(issue!.pipeId).toBe("submit-handler");
    expect(issue!.contractId).toBe("playbook-state");
  });

  it("persist load 후에 submit 실행 — 정상", () => {
    const simResult = simulate({
      graph: earlyLoadGraph,
      initialEvent: { eventKey: "app_init" },
    });

    const binding: TimedMountFlowBinding = {
      nesting: asyncNesting,
      graph: earlyLoadGraph,
      bindings: {
        "persist-loader": {
          scopeId: "feature-context",
          scopeContracts: [],
        },
        "submit-handler": {
          scopeId: "handlers",
          scopeContracts: ["playbook-state"],
        },
      },
    };

    const result = validateContractTiming(binding, simResult);
    expect(result.valid).toBe(true);
    expect(result.issues.filter(i => i.code === "consume-before-ready")).toHaveLength(0);
  });

  it("readyAfter 이벤트가 시뮬에 없음 — readiness-event-missing warning", () => {
    // persist-loader가 없는 graph에서 시뮬
    const simResult = simulate({
      graph: {
        graphId: "no-loader",
        version: "v1",
        pipes: [lateLoadGraph.pipes[0]], // submit-handler만
        connections: [],
      },
      initialEvent: { eventKey: "form_submit" },
    });

    const binding: TimedMountFlowBinding = {
      nesting: asyncNesting,
      graph: lateLoadGraph,
      bindings: {
        "submit-handler": { scopeId: "handlers", scopeContracts: ["playbook-state"] },
      },
    };

    const result = validateContractTiming(binding, simResult);
    const missing = result.issues.find(i => i.code === "readiness-event-missing");
    expect(missing).toBeDefined();
  });
});

// ── readinessTimeline 테스트 ─────────────────────────

describe("readinessTimeline", () => {
  it("readyAfter가 없는 계약은 즉시 (-1)", () => {
    const simResult = simulate({
      graph: earlyLoadGraph,
      initialEvent: { eventKey: "app_init" },
    });

    const binding: TimedMountFlowBinding = {
      nesting: asyncNesting,
      graph: earlyLoadGraph,
      bindings: {},
    };

    const result = validateContractTiming(binding, simResult);
    const logging = result.readinessTimeline.find(r => r.contractId === "logging-session")!;
    expect(logging.readyAtStep).toBe(-1); // 즉시

    const state = result.readinessTimeline.find(r => r.contractId === "playbook-state")!;
    expect(state.readyAtStep).toBeGreaterThanOrEqual(0); // persist_load_complete 이후
  });
});

// ── delegation gap 테스트 ────────────────────────────

describe("delegation-gap", () => {
  /** 역방향 위임이 있는 graph */
  const delegationGraph: PipeGraph = {
    graphId: "delegation",
    version: "v1",
    pipes: [
      {
        pipeId: "submit-handler",
        version: "v1",
        trigger: { eventKey: "form_submit" },
        flow: { kind: "sequence", steps: [step("소비"), step("생산", "submit_started")] },
        produces: ["submit_started"],
      },
      {
        pipeId: "view-render",
        version: "v1",
        trigger: { eventKey: "submit_started" },
        flow: step("소비"),
      },
      {
        pipeId: "persist-complete",
        version: "v1",
        trigger: { eventKey: "submit_started" },
        flow: step("저장", "submit_persist_complete"),
        produces: ["submit_persist_complete"],
      },
    ],
    connections: [
      { from: "submit-handler", to: "view-render", kind: "event" },
      { from: "submit-handler", to: "persist-complete", kind: "event" },
    ],
  };

  it("위임 중 view가 stale data 소비 — delegation-gap error", () => {
    const simResult = simulate({
      graph: delegationGraph,
      initialEvent: { eventKey: "form_submit" },
    });

    const nesting: ScopeNesting = {
      nestingId: "delegation-test",
      scopes: [
        { scopeId: "context", provides: [{ contractId: "state", type: "state" }], consumes: [] },
        { scopeId: "handlers", provides: [], consumes: [{ contractId: "state", type: "state" }] },
        { scopeId: "view", provides: [], consumes: [{ contractId: "state", type: "state" }] },
      ],
    };

    const binding: TimedMountFlowBinding = {
      nesting,
      graph: delegationGraph,
      bindings: {
        "submit-handler": {
          scopeId: "handlers",
          scopeContracts: ["state"],
          delegatesTo: [{
            contractId: "state",
            completionEvent: "submit_persist_complete",
            tolerateStale: false,
          }],
        },
        "view-render": {
          scopeId: "view",
          scopeContracts: ["state"],
        },
        "persist-complete": {
          scopeId: "context",
          scopeContracts: [],
        },
      },
    };

    const result = validateContractTiming(binding, simResult);
    expect(result.valid).toBe(false);

    const gap = result.delegationGaps.find(g => g.contractId === "state");
    expect(gap).toBeDefined();
    expect(gap!.staleConsumers).toContain("view-render");

    const issue = result.issues.find(i => i.code === "delegation-gap");
    expect(issue).toBeDefined();
  });

  it("tolerateStale: true — warning으로 완화", () => {
    const simResult = simulate({
      graph: delegationGraph,
      initialEvent: { eventKey: "form_submit" },
    });

    const nesting: ScopeNesting = {
      nestingId: "tolerate-test",
      scopes: [
        { scopeId: "context", provides: [{ contractId: "state", type: "state" }], consumes: [] },
        { scopeId: "handlers", provides: [], consumes: [{ contractId: "state", type: "state" }] },
        { scopeId: "view", provides: [], consumes: [{ contractId: "state", type: "state" }] },
      ],
    };

    const binding: TimedMountFlowBinding = {
      nesting,
      graph: delegationGraph,
      bindings: {
        "submit-handler": {
          scopeId: "handlers",
          scopeContracts: ["state"],
          delegatesTo: [{
            contractId: "state",
            completionEvent: "submit_persist_complete",
            tolerateStale: true,  // ← stale 허용
          }],
        },
        "view-render": { scopeId: "view", scopeContracts: ["state"] },
        "persist-complete": { scopeId: "context", scopeContracts: [] },
      },
    };

    const result = validateContractTiming(binding, simResult);
    expect(result.valid).toBe(true); // warning이므로 valid
    const issue = result.issues.find(i => i.code === "delegation-gap");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
  });
});
