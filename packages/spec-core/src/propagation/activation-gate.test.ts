// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * activation-gate 테스트.
 *
 * 순수 함수 checkActivationReadiness를 mock GraphRegistry로 검증.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GraphRegistry } from "dkg";
import { checkActivationReadiness } from "./activation-gate.js";
import type {
  PrefixNode,
  DomainNode,
  ConstraintNode,
  ObservationNode,
} from "dkg";

let graph: GraphRegistry;

beforeEach(() => {
  graph = new GraphRegistry();
});

/** 테스트용 prefix 노드 등록 */
function addPrefix(id: string): void {
  const node: PrefixNode = {
    kind: "prefix",
    id,
    name: id,
    dimLabels: ["dim1"],
  };
  graph.addNode(node);
}

/** 테스트용 domain 노드 등록 + prefix 연결 */
function addDomain(domainId: string, prefixes: string[]): void {
  const node: DomainNode = {
    kind: "domain",
    id: domainId,
    name: domainId,
    prefixes,
    sharedAxes: [],
    boundary: { exports: prefixes, internal: [] },
  };
  graph.addNode(node);
  for (const p of prefixes) {
    graph.addEdge("contains", domainId, p);
  }
}

/** 테스트용 constraint 노드 등록 + 대상 연결 */
function addConstraint(
  id: string,
  targetId: string,
  opts?: { lifecycle?: "active" | "suspended" | "retired"; formal?: string },
): void {
  const node: ConstraintNode = {
    kind: "constraint",
    id,
    rule: `Rule for ${id}`,
    scope: [targetId],
    lifecycle: opts?.lifecycle ?? "active",
    ...(opts?.formal ? { formal: opts.formal } : {}),
  };
  graph.addNode(node);
  graph.addEdge("constrains", id, targetId);
}

/** 테스트용 observation 노드 등록 + 대상 연결 */
function addObservation(
  id: string,
  targetId: string,
  opts?: {
    source?: "metric" | "manual" | "review" | "runtime";
    intent?: "action-needed" | "monitoring" | "completed";
    suggestion?: any;
    resolution?: any;
  },
): void {
  const node: ObservationNode = {
    kind: "observation",
    id,
    date: "2026-03-20",
    source: opts?.source ?? "manual",
    subjects: [targetId],
    finding: `Finding for ${id}`,
    ...(opts?.intent ? { intent: opts.intent } : {}),
    ...(opts?.suggestion ? { suggestion: opts.suggestion } : {}),
    ...(opts?.resolution ? { resolution: opts.resolution } : {}),
  };
  graph.addNode(node);
  graph.addEdge("observes", id, targetId);
}

describe("checkActivationReadiness", () => {
  // ── 기본 동작 ──────────────────────────────────────────

  it("constraint/observation 없는 prefix → allowed=true, 빈 diagnostics", () => {
    addPrefix("tracking");
    const result = checkActivationReadiness(graph, "tracking");

    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.constraintViolations).toBe(0);
  });

  // ── Constraint 검사 ────────────────────────────────────

  it("활성 constraint violation → warn 모드에서 allowed=true + diagnostics 포함", () => {
    addPrefix("tracking");
    // formal 없는 constraint는 pass됨
    addConstraint("C-001", "tracking");

    const result = checkActivationReadiness(graph, "tracking", { mode: "warn" });

    expect(result.allowed).toBe(true);
    // formal 없으면 위반 아님 → pass
    expect(result.constraintViolations).toBe(0);
  });

  it("formal constraint violation → strict 모드에서 allowed=false", () => {
    addPrefix("tracking");
    // 알 수 없는 formal이 아닌, NOT EXISTS 패턴으로 위반 유도
    // tracking이 dim1, dim2를 동시에 사용하면 위반
    addPrefix("test-prefix");
    // test-prefix가 axisA, axisB를 composes
    graph.addNode({ kind: "axis", id: "axisA", name: "A", currentVersions: ["v1"] });
    graph.addNode({ kind: "axis", id: "axisB", name: "B", currentVersions: ["v1"] });
    graph.addEdge("composes", "test-prefix", "axisA");
    graph.addEdge("composes", "test-prefix", "axisB");

    addConstraint("C-FORMAL", "tracking", {
      formal: "NOT EXISTS(prefix p WHERE p.dims HAS 'axisA' AND p.dims HAS 'axisB')",
    });

    const result = checkActivationReadiness(graph, "tracking", { mode: "strict" });

    expect(result.allowed).toBe(false);
    expect(result.constraintViolations).toBe(1);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].source).toBe("constraint");
    expect(result.diagnostics[0].level).toBe("error");
  });

  it("formal constraint violation → warn 모드에서 allowed=true", () => {
    addPrefix("tracking");
    addPrefix("test-prefix");
    graph.addNode({ kind: "axis", id: "axisA", name: "A", currentVersions: ["v1"] });
    graph.addNode({ kind: "axis", id: "axisB", name: "B", currentVersions: ["v1"] });
    graph.addEdge("composes", "test-prefix", "axisA");
    graph.addEdge("composes", "test-prefix", "axisB");

    addConstraint("C-FORMAL", "tracking", {
      formal: "NOT EXISTS(prefix p WHERE p.dims HAS 'axisA' AND p.dims HAS 'axisB')",
    });

    const result = checkActivationReadiness(graph, "tracking", { mode: "warn" });

    expect(result.allowed).toBe(true);
    expect(result.constraintViolations).toBe(1);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("비활성 constraint → 무시", () => {
    addPrefix("tracking");
    addConstraint("C-SUSPENDED", "tracking", { lifecycle: "suspended" });

    const result = checkActivationReadiness(graph, "tracking");

    expect(result.diagnostics).toHaveLength(0);
    expect(result.constraintViolations).toBe(0);
  });

  // ── Observation 검사 ───────────────────────────────────

  it("미해결 action-needed observation → warning diagnostic", () => {
    addPrefix("tracking");
    addObservation("OBS-001", "tracking", {
      source: "metric",
      // metric source → 기본 intent: action-needed
    });

    const result = checkActivationReadiness(graph, "tracking");

    expect(result.allowed).toBe(true); // observation은 warning만
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].source).toBe("observation");
    expect(result.diagnostics[0].level).toBe("warning");
  });

  it("monitoring intent observation → 무시", () => {
    addPrefix("tracking");
    addObservation("OBS-MON", "tracking", {
      source: "manual",
      intent: "monitoring",
    });

    const result = checkActivationReadiness(graph, "tracking");

    expect(result.diagnostics).toHaveLength(0);
  });

  it("해결된 observation → 무시", () => {
    addPrefix("tracking");
    addObservation("OBS-RESOLVED", "tracking", {
      source: "metric",
      resolution: {
        decisionId: "DEC-001",
        outcome: "accepted",
      },
    });

    const result = checkActivationReadiness(graph, "tracking");

    expect(result.diagnostics).toHaveLength(0);
  });

  // ── Domain health 검사 ─────────────────────────────────

  it("domain constraint violation → domain-health warning", () => {
    addPrefix("tracking");
    addDomain("shopping-domain", ["tracking"]);

    // domain에 대한 constraint 위반
    addPrefix("other-prefix");
    graph.addNode({ kind: "axis", id: "dimX", name: "X", currentVersions: ["v1"] });
    graph.addNode({ kind: "axis", id: "dimY", name: "Y", currentVersions: ["v1"] });
    graph.addEdge("composes", "other-prefix", "dimX");
    graph.addEdge("composes", "other-prefix", "dimY");

    addConstraint("C-DOMAIN", "shopping-domain", {
      formal: "NOT EXISTS(prefix p WHERE p.dims HAS 'dimX' AND p.dims HAS 'dimY')",
    });

    const result = checkActivationReadiness(graph, "tracking");

    const domainDiag = result.diagnostics.filter(d => d.source === "domain-health");
    expect(domainDiag).toHaveLength(1);
    expect(domainDiag[0].level).toBe("warning");
    expect(domainDiag[0].message).toContain("shopping-domain");
  });

  // ── 복합 시나리오 ──────────────────────────────────────

  it("constraint violation + observation → 모든 diagnostics 수집", () => {
    addPrefix("tracking");

    // constraint violation
    addPrefix("violating-prefix");
    graph.addNode({ kind: "axis", id: "a1", name: "A1", currentVersions: ["v1"] });
    graph.addNode({ kind: "axis", id: "a2", name: "A2", currentVersions: ["v1"] });
    graph.addEdge("composes", "violating-prefix", "a1");
    graph.addEdge("composes", "violating-prefix", "a2");

    addConstraint("C-MIX", "tracking", {
      formal: "NOT EXISTS(prefix p WHERE p.dims HAS 'a1' AND p.dims HAS 'a2')",
    });

    // observation
    addObservation("OBS-MIX", "tracking", { source: "metric" });

    const result = checkActivationReadiness(graph, "tracking", { mode: "strict" });

    expect(result.allowed).toBe(false);
    expect(result.constraintViolations).toBe(1);
    expect(result.diagnostics).toHaveLength(2);

    const sources = result.diagnostics.map(d => d.source);
    expect(sources).toContain("constraint");
    expect(sources).toContain("observation");
  });

  // ── 기본 모드 ──────────────────────────────────────────

  it("options 미지정 → 기본 warn 모드", () => {
    addPrefix("tracking");
    addPrefix("vp");
    graph.addNode({ kind: "axis", id: "x1", name: "X1", currentVersions: ["v1"] });
    graph.addNode({ kind: "axis", id: "x2", name: "X2", currentVersions: ["v1"] });
    graph.addEdge("composes", "vp", "x1");
    graph.addEdge("composes", "vp", "x2");

    addConstraint("C-DEFAULT", "tracking", {
      formal: "NOT EXISTS(prefix p WHERE p.dims HAS 'x1' AND p.dims HAS 'x2')",
    });

    const result = checkActivationReadiness(graph, "tracking");

    // 기본 warn 모드 → 항상 allowed
    expect(result.allowed).toBe(true);
    expect(result.constraintViolations).toBe(1);
  });
});
