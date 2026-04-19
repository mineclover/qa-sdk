// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Scope Lifecycle 패턴 테스트 — 비활성화 영향 분석 파이프라인
 */

import { describe, it, expect } from "vitest";
import type { ScopeNesting, SimulationGuards } from "./scope-nesting.js";
import {
  snapshotProviders,
  traceContracts,
  classifyImpact,
  analyzeDeactivation,
} from "./scope-nesting-lifecycle.js";

// ── fixture ─────────────────────────────────────────

const playbook: ScopeNesting = {
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

// ── Stage 1: snapshotProviders ──────────────────────

describe("snapshotProviders", () => {
  it("기본 provider map 생성", () => {
    const snap = snapshotProviders(playbook);
    expect(snap.providers["logging-session"]).toEqual({ scopeId: "qa-bridge", depth: 0 });
    expect(snap.providers["playbook-state"]).toEqual({ scopeId: "feature-context", depth: 1 });
    expect(snap.providers["persist-adapter"]).toEqual({ scopeId: "feature-context", depth: 1 });
    expect(snap.providers["submission-handlers"]).toEqual({ scopeId: "handlers", depth: 2 });
    expect(snap.guardFiltered).toHaveLength(0);
  });

  it("guard 필터링 — 비활성 계약 제외", () => {
    const guards: SimulationGuards = {
      isEncodable: (id) => id !== "logging-session",
    };
    const snap = snapshotProviders(playbook, guards);
    expect(snap.providers["logging-session"]).toBeUndefined();
    expect(snap.guardFiltered).toContain("logging-session");
    // 나머지는 정상
    expect(snap.providers["playbook-state"]).toBeDefined();
  });

  it("override 반영 — 하위 scope가 상위 provider 교체", () => {
    const withOverride: ScopeNesting = {
      nestingId: "override",
      scopes: [
        { scopeId: "parent", provides: [{ contractId: "state", type: "state" }], consumes: [] },
        { scopeId: "child", provides: [{ contractId: "state", type: "state", override: true }], consumes: [] },
      ],
    };
    const snap = snapshotProviders(withOverride);
    expect(snap.providers["state"]).toEqual({ scopeId: "child", depth: 1 });
  });

  it("빈 nesting 처리", () => {
    const empty: ScopeNesting = { nestingId: "empty", scopes: [] };
    const snap = snapshotProviders(empty);
    expect(Object.keys(snap.providers)).toHaveLength(0);
    expect(snap.guardFiltered).toHaveLength(0);
  });
});

// ── Stage 2: traceContracts ─────────────────────────

describe("traceContracts", () => {
  it("단일 계약 추적 — qa-bridge의 logging-session 소비자", () => {
    const snap = snapshotProviders(playbook);
    const traces = traceContracts(playbook, snap, "qa-bridge");

    expect(traces).toHaveLength(1);
    const trace = traces[0];
    expect(trace.contractId).toBe("logging-session");
    expect(trace.provider).toEqual({ scopeId: "qa-bridge", depth: 0 });
    expect(trace.consumers).toHaveLength(2);
    expect(trace.consumers.map(c => c.scopeId)).toContain("feature-context");
    expect(trace.consumers.map(c => c.scopeId)).toContain("handlers");
    expect(trace.hasAlternative).toBe(false);
  });

  it("다중 계약 추적 — feature-context의 state + persist", () => {
    const snap = snapshotProviders(playbook);
    const traces = traceContracts(playbook, snap, "feature-context");

    expect(traces).toHaveLength(2);
    const stateTrace = traces.find(t => t.contractId === "playbook-state")!;
    expect(stateTrace.consumers.map(c => c.scopeId)).toContain("handlers");
    expect(stateTrace.consumers.map(c => c.scopeId)).toContain("view");

    const persistTrace = traces.find(t => t.contractId === "persist-adapter")!;
    expect(persistTrace.consumers).toHaveLength(0); // 아무도 소비 안 함
  });

  it("대체 provider 존재 → hasAlternative=true", () => {
    const withAlt: ScopeNesting = {
      nestingId: "alt",
      scopes: [
        { scopeId: "a", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "b", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "c", provides: [], consumes: [{ contractId: "x", type: "state" }] },
      ],
    };
    const snap = snapshotProviders(withAlt);
    const traces = traceContracts(withAlt, snap, "a");

    expect(traces).toHaveLength(1);
    expect(traces[0].hasAlternative).toBe(true);
  });

  it("미존재 scopeId → 빈 결과", () => {
    const snap = snapshotProviders(playbook);
    const traces = traceContracts(playbook, snap, "nonexistent");
    expect(traces).toHaveLength(0);
  });

  it("override로 provider가 아닌 경우 → trace 안 함", () => {
    const withOverride: ScopeNesting = {
      nestingId: "ov",
      scopes: [
        { scopeId: "a", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "b", provides: [{ contractId: "x", type: "state", override: true }], consumes: [] },
        { scopeId: "c", provides: [], consumes: [{ contractId: "x", type: "state" }] },
      ],
    };
    const snap = snapshotProviders(withOverride);
    // a는 override당해서 최종 provider가 아님
    const traces = traceContracts(withOverride, snap, "a");
    expect(traces).toHaveLength(0);
  });

  it("required=false 소비자 추적", () => {
    const withOptional: ScopeNesting = {
      nestingId: "opt",
      scopes: [
        { scopeId: "p", provides: [{ contractId: "log", type: "logging" }], consumes: [] },
        { scopeId: "c", provides: [], consumes: [{ contractId: "log", type: "logging", required: false }] },
      ],
    };
    const snap = snapshotProviders(withOptional);
    const traces = traceContracts(withOptional, snap, "p");

    expect(traces[0].consumers[0].required).toBe(false);
  });
});

// ── Stage 3: classifyImpact ─────────────────────────

describe("classifyImpact", () => {
  it("affected/unaffected 분류", () => {
    const snap = snapshotProviders(playbook);
    const traces = traceContracts(playbook, snap, "qa-bridge");
    const impact = classifyImpact(playbook, "qa-bridge", traces, snap);

    expect(impact.deactivated).toBe("qa-bridge");
    expect(impact.affected).toHaveLength(2);
    expect(impact.affected.map(a => a.scopeId)).toContain("feature-context");
    expect(impact.affected.map(a => a.scopeId)).toContain("handlers");
    expect(impact.affected.find(a => a.scopeId === "feature-context")!.lostContracts).toEqual(["logging-session"]);
    expect(impact.unaffected).toEqual(["view"]);
  });

  it("대체 provider 있으면 unaffected", () => {
    const withAlt: ScopeNesting = {
      nestingId: "alt",
      scopes: [
        { scopeId: "a", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "b", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "c", provides: [], consumes: [{ contractId: "x", type: "state" }] },
      ],
    };
    const snap = snapshotProviders(withAlt);
    const traces = traceContracts(withAlt, snap, "a");
    const impact = classifyImpact(withAlt, "a", traces, snap);

    expect(impact.affected).toHaveLength(0);
    expect(impact.unaffected).toContain("b");
    expect(impact.unaffected).toContain("c");
  });

  it("계보(traces) 포함", () => {
    const snap = snapshotProviders(playbook);
    const traces = traceContracts(playbook, snap, "qa-bridge");
    const impact = classifyImpact(playbook, "qa-bridge", traces, snap);

    expect(impact.traces).toBe(traces);
    expect(impact.traces).toHaveLength(1);
    expect(impact.traces[0].contractId).toBe("logging-session");
  });
});

// ── 통합: analyzeDeactivation ───────────────────────

describe("analyzeDeactivation", () => {
  it("스펙 예시 재현 — qa-bridge 비활성화", () => {
    const result = analyzeDeactivation(playbook, "qa-bridge");

    expect(result.deactivated).toBe("qa-bridge");
    expect(result.affected).toHaveLength(2);
    expect(result.affected).toContainEqual({
      scopeId: "feature-context",
      lostContracts: ["logging-session"],
    });
    expect(result.affected).toContainEqual({
      scopeId: "handlers",
      lostContracts: ["logging-session"],
    });
    expect(result.unaffected).toEqual(["view"]);
    expect(result.traces).toHaveLength(1);
    expect(result.guardFiltered).toHaveLength(0);
  });

  it("guard 통합 — 이미 비활성 계약은 guardFiltered", () => {
    const guards: SimulationGuards = {
      isEncodable: (id) => id !== "logging-session",
    };
    const result = analyzeDeactivation(playbook, "qa-bridge", guards);

    // logging-session이 guard로 제거됨 → qa-bridge가 provider인 계약 없음
    expect(result.affected).toHaveLength(0);
    expect(result.guardFiltered).toContain("logging-session");
    // 모든 하위 scope가 unaffected
    expect(result.unaffected).toContain("feature-context");
    expect(result.unaffected).toContain("handlers");
    expect(result.unaffected).toContain("view");
  });

  it("feature-context 비활성화 — state + persist 영향", () => {
    const result = analyzeDeactivation(playbook, "feature-context");

    expect(result.deactivated).toBe("feature-context");
    // handlers: playbook-state 소실
    // view: playbook-state 소실
    const handlersAffected = result.affected.find(a => a.scopeId === "handlers");
    expect(handlersAffected).toBeDefined();
    expect(handlersAffected!.lostContracts).toContain("playbook-state");

    const viewAffected = result.affected.find(a => a.scopeId === "view");
    expect(viewAffected).toBeDefined();
    expect(viewAffected!.lostContracts).toContain("playbook-state");

    // qa-bridge는 feature-context의 소비자가 아님
    expect(result.unaffected).toContain("qa-bridge");
  });

  it("view 비활성화 — 아무도 영향 안 받음 (leaf scope)", () => {
    const result = analyzeDeactivation(playbook, "view");

    expect(result.deactivated).toBe("view");
    // view는 provides가 없으므로 아무도 영향 안 받음
    expect(result.affected).toHaveLength(0);
    expect(result.unaffected).toContain("qa-bridge");
    expect(result.unaffected).toContain("feature-context");
    expect(result.unaffected).toContain("handlers");
  });

  it("fail-open — 미존재 scopeId → 빈 결과", () => {
    const result = analyzeDeactivation(playbook, "nonexistent");

    expect(result.deactivated).toBe("nonexistent");
    expect(result.affected).toHaveLength(0);
    // 모든 scope가 unaffected
    expect(result.unaffected).toHaveLength(4);
  });

  it("override 통합 — 대체 provider 존재 시 unaffected", () => {
    const withOverride: ScopeNesting = {
      nestingId: "ov-integration",
      scopes: [
        { scopeId: "base", provides: [{ contractId: "config", type: "state" }], consumes: [] },
        { scopeId: "enhanced", provides: [{ contractId: "config", type: "state", override: true }], consumes: [] },
        { scopeId: "consumer", provides: [], consumes: [{ contractId: "config", type: "state" }] },
      ],
    };

    // enhanced가 최종 provider → enhanced 비활성화 시 base가 대체 가능
    const result = analyzeDeactivation(withOverride, "enhanced");
    expect(result.affected).toHaveLength(0);
    expect(result.unaffected).toContain("base");
    expect(result.unaffected).toContain("consumer");
    expect(result.traces[0].hasAlternative).toBe(true);
  });
});
