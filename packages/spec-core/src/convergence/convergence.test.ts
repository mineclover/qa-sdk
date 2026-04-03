import { describe, it, expect, beforeEach } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { GraphRegistry, deriveFromCatalog } from "dkg";
import {
  compareAxes, comparePrefixes, scanAxisOverlaps,
  compareDecisions, scanDecisionConflicts,
  discoverCausality, discoverCausalityWithObservations,
  analyzeSimplification, scanAllSimplifications,
  recommendFromSimplification, recommendFromObservation, recommendFromCausality, recommendAll,
  runConvergenceAnalysis,
} from "@qa-sdk/convergence";
import type { DecisionNode, IntentLinkNode, DomainNode } from "dkg";
import type { CoOccurrence, EntryUsage, AddressUsage, UsageData } from "@qa-sdk/convergence";

let graph: GraphRegistry;

beforeEach(() => {
  graph = deriveFromCatalog(DEMO_CATALOG);
});

// ═══════════════════════════════════════════════════════════════
//  SymbolComparator
// ═══════════════════════════════════════════════════════════════

describe("SymbolComparator", () => {
  it("axis 비교 — 낮은 중복", () => {
    const result = compareAxes(
      "rbac_role", ["admin", "editor", "viewer"],
      "role", ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"],
    );

    expect(result.sharedEntries).toEqual(["admin", "viewer"]);
    expect(result.overlapRatio).toBeLessThan(0.3);
    expect(result.recommendation).toBe("keep-separate");
  });

  it("axis 비교 — 높은 중복 → merge 추천", () => {
    const result = compareAxes(
      "axis_a", ["read", "write", "delete", "admin"],
      "axis_b", ["read", "write", "delete"],
    );

    expect(result.sharedEntries).toEqual(["read", "write", "delete"]);
    expect(result.overlapRatio).toBeGreaterThanOrEqual(0.7);
    expect(result.recommendation).toBe("merge");
  });

  it("axis 비교 — 높은 중복 + 같은 prefix → alias 추천", () => {
    const result = compareAxes(
      "axis_a", ["read", "write", "delete", "admin"],
      "axis_b", ["read", "write", "delete"],
      ["some_prefix"],
    );

    expect(result.overlapRatio).toBeGreaterThanOrEqual(0.7);
    expect(result.recommendation).toBe("alias");
    expect(result.reason).toContain("some_prefix");
  });

  it("axis 비교 — 중복 없음", () => {
    const result = compareAxes(
      "env", ["dev", "stage", "prod"],
      "action", ["read", "write", "delete"],
    );

    expect(result.sharedEntries).toHaveLength(0);
    expect(result.recommendation).toBe("keep-separate");
  });

  it("prefix 비교 — permission과 rbac", () => {
    const result = comparePrefixes(graph, "permission", "rbac");
    // permission은 role axis, rbac은 rbac_role axis → 공유 축 없음
    expect(result.sharedAxes).toHaveLength(0);
    expect(result.recommendation).toBe("keep-separate");
  });

  it("scanAxisOverlaps — DEMO_CATALOG에서 중복 스캔", () => {
    // rbac_role과 role에 "admin"이 공통
    const entriesMap = new Map<string, readonly string[]>();
    const catalog = DEMO_CATALOG;
    for (const [id, axis] of Object.entries(catalog.axes)) {
      const latestVersion = Object.keys(axis.versions).pop()!;
      const snap = axis.versions[latestVersion as keyof typeof axis.versions];
      if (snap && "entries" in snap) {
        entriesMap.set(id, [...snap.entries] as string[]);
      }
    }

    const overlaps = scanAxisOverlaps(graph, entriesMap);
    // rbac_role과 role에서 "admin" 공유 발견되어야 함
    const roleOverlap = overlaps.find(
      o => (o.a === "rbac_role" && o.b === "role") || (o.a === "role" && o.b === "rbac_role"),
    );
    expect(roleOverlap).toBeDefined();
    expect(roleOverlap!.sharedEntries).toContain("admin");
  });
});

// ═══════════════════════════════════════════════════════════════
//  DecisionComparator
// ═══════════════════════════════════════════════════════════════

describe("DecisionComparator", () => {
  it("같은 대상 → redundant", () => {
    const dec1: DecisionNode = {
      kind: "decision", id: "DEC-001", date: "2026-03-15",
      title: "role capacity 8", context: "", rationale: "bitmask", lifecycle: "active",
    };
    const dec2: DecisionNode = {
      kind: "decision", id: "DEC-002", date: "2026-03-20",
      title: "role capacity 16", context: "", rationale: "확장 필요", lifecycle: "active",
    };
    graph.addNode(dec1);
    graph.addNode(dec2);
    graph.addEdge("justifies", "DEC-001", "role");
    graph.addEdge("justifies", "DEC-002", "role");

    const result = compareDecisions(graph, "DEC-001", "DEC-002");
    expect(result.conflict).toBe("redundant");
    expect(result.sharedTargets).toContain("role");
  });

  it("상반 rationale → contradictory", () => {
    const dec1: DecisionNode = {
      kind: "decision", id: "DEC-ADD", date: "2026-03-15",
      title: "entry 추가", context: "", rationale: "사용량 증가로 entry 추가 필요", lifecycle: "active",
    };
    const dec2: DecisionNode = {
      kind: "decision", id: "DEC-DEL", date: "2026-03-20",
      title: "entry 정리", context: "", rationale: "사용량 감소로 entry 제거 필요", lifecycle: "active",
    };
    graph.addNode(dec1);
    graph.addNode(dec2);
    graph.addEdge("justifies", "DEC-ADD", "role");
    graph.addEdge("justifies", "DEC-DEL", "role");

    const result = compareDecisions(graph, "DEC-ADD", "DEC-DEL");
    expect(result.conflict).toBe("contradictory");
  });

  it("다른 대상 → compatible", () => {
    const dec1: DecisionNode = {
      kind: "decision", id: "DEC-A", date: "2026-03-15",
      title: "A", context: "", rationale: "", lifecycle: "active",
    };
    const dec2: DecisionNode = {
      kind: "decision", id: "DEC-B", date: "2026-03-20",
      title: "B", context: "", rationale: "", lifecycle: "active",
    };
    graph.addNode(dec1);
    graph.addNode(dec2);
    graph.addEdge("justifies", "DEC-A", "role");
    graph.addEdge("justifies", "DEC-B", "env");

    const result = compareDecisions(graph, "DEC-A", "DEC-B");
    expect(result.conflict).toBe("compatible");
  });

  it("하나가 superseded → superseding", () => {
    const dec1: DecisionNode = {
      kind: "decision", id: "DEC-OLD", date: "2026-03-15",
      title: "old", context: "", rationale: "", lifecycle: "superseded",
    };
    const dec2: DecisionNode = {
      kind: "decision", id: "DEC-NEW", date: "2026-03-20",
      title: "new", context: "", rationale: "", lifecycle: "active",
    };
    graph.addNode(dec1);
    graph.addNode(dec2);
    graph.addEdge("justifies", "DEC-OLD", "role");
    graph.addEdge("justifies", "DEC-NEW", "role");

    const result = compareDecisions(graph, "DEC-OLD", "DEC-NEW");
    expect(result.conflict).toBe("superseding");
  });

  it("scanDecisionConflicts — 충돌 쌍 자동 발견", () => {
    const dec1: DecisionNode = {
      kind: "decision", id: "D1", date: "2026-03-15",
      title: "a", context: "", rationale: "", lifecycle: "active",
    };
    const dec2: DecisionNode = {
      kind: "decision", id: "D2", date: "2026-03-20",
      title: "b", context: "", rationale: "", lifecycle: "active",
    };
    graph.addNode(dec1);
    graph.addNode(dec2);
    graph.addEdge("justifies", "D1", "role");
    graph.addEdge("justifies", "D2", "role");

    const conflicts = scanDecisionConflicts(graph);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].conflict).toBe("redundant");
  });
});

// ═══════════════════════════════════════════════════════════════
//  CausalDiscovery
// ═══════════════════════════════════════════════════════════════

describe("CausalDiscovery", () => {
  it("high confidence → intent-link 추천", () => {
    const coOccurrences: CoOccurrence[] = [{
      sourcePrefix: "auth_event", sourceEntry: "login",
      targetPrefix: "auth_event", targetEntry: "token_refresh",
      count: 15000, totalSourceCount: 15200,
    }];

    const candidates = discoverCausality(graph, coOccurrences);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe("high");
    expect(candidates[0].suggestion).toBe("intent-link");
    expect(candidates[0].coOccurrenceRate).toBeGreaterThan(0.95);
  });

  it("medium confidence → constraint 추천", () => {
    const coOccurrences: CoOccurrence[] = [{
      sourcePrefix: "order_event", sourceEntry: "create",
      targetPrefix: "cart_event", targetEntry: "checkout",
      count: 800, totalSourceCount: 950,
    }];

    const candidates = discoverCausality(graph, coOccurrences);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe("medium");
    expect(candidates[0].suggestion).toBe("constraint");
  });

  it("이미 IntentLink 있으면 제외", () => {
    const link: IntentLinkNode = {
      kind: "intent-link", id: "IL-exists",
      endpoints: ["auth_event"], via: "auth_action",
      intent: "login 후 token_refresh",
    };
    graph.addNode(link);
    graph.addEdge("binds", "IL-exists", "auth_event");

    const coOccurrences: CoOccurrence[] = [{
      sourcePrefix: "auth_event", sourceEntry: "login",
      targetPrefix: "auth_event", targetEntry: "token_refresh",
      count: 15000, totalSourceCount: 15200,
    }];

    const candidates = discoverCausality(graph, coOccurrences);
    // IntentLink intent에 "login"과 "token_refresh" 포함 → 제외됨
    expect(candidates).toHaveLength(0);
  });

  it("낮은 빈도 → 무시", () => {
    const coOccurrences: CoOccurrence[] = [{
      sourcePrefix: "auth_event", sourceEntry: "login",
      targetPrefix: "auth_event", targetEntry: "token_refresh",
      count: 10, totalSourceCount: 100,
    }];

    const candidates = discoverCausality(graph, coOccurrences);
    expect(candidates).toHaveLength(0);
  });

  it("discoverCausalityWithObservations — Observation 노드 생성", () => {
    const coOccurrences: CoOccurrence[] = [{
      sourcePrefix: "auth_event", sourceEntry: "login",
      targetPrefix: "auth_event", targetEntry: "token_refresh",
      count: 15000, totalSourceCount: 15200,
    }];

    const { candidates, observations } = discoverCausalityWithObservations(graph, coOccurrences, { date: "2026-03-21" });
    expect(candidates).toHaveLength(1);
    expect(observations).toHaveLength(1);
    expect(observations[0].id).toBe("OBS-CAUSAL-auth_event-login-auth_event-token_refresh");
    expect(observations[0].intent).toBe("action-needed");
    expect(observations[0].source).toBe("runtime");
    expect(observations[0].date).toBe("2026-03-21");
  });
});

// ═══════════════════════════════════════════════════════════════
//  SimplificationAdvisor
// ═══════════════════════════════════════════════════════════════

describe("SimplificationAdvisor", () => {
  it("단일 값 차원 → remove-dim 제안", () => {
    const entryUsages: EntryUsage[] = [
      { axisId: "trackAction", entry: "click", count: 5000, lastSeen: "2026-03-20" },
      { axisId: "trackAction", entry: "view", count: 3000, lastSeen: "2026-03-20" },
      { axisId: "page", entry: "home", count: 8000, lastSeen: "2026-03-20" }, // 단일 값
      { axisId: "userType", entry: "member", count: 7000, lastSeen: "2026-03-20" },
      { axisId: "userType", entry: "guest", count: 100, lastSeen: "2026-03-20" },
    ];

    const addressUsages: AddressUsage[] = [
      { prefix: "tracking", version: "v1", address: 0, count: 100 },
      { prefix: "tracking", version: "v1", address: 1, count: 200 },
    ];

    const result = analyzeSimplification(graph, "tracking", entryUsages, addressUsages);

    expect(result.singleValueDims).toHaveLength(1);
    expect(result.singleValueDims[0].dim).toBe("page");
    expect(result.suggestions.some(s => s.kind === "remove-dim")).toBe(true);
  });

  it("저사용 entry → deactivate 제안", () => {
    const entryUsages: EntryUsage[] = [
      { axisId: "trackAction", entry: "click", count: 5000, lastSeen: "2026-03-20" },
      { axisId: "trackAction", entry: "view", count: 3000, lastSeen: "2026-03-20" },
      { axisId: "trackAction", entry: "scroll", count: 10, lastSeen: "2026-03-20" },
      { axisId: "trackAction", entry: "submit", count: 2000, lastSeen: "2026-03-20" },
    ];

    const result = analyzeSimplification(graph, "tracking", entryUsages, []);
    expect(result.lowUsageEntries.some(e => e.entry === "scroll")).toBe(true);
    expect(result.suggestions.some(s => s.kind === "deactivate-entry")).toBe(true);
  });

  it("addressSpaceSize 외부 지정", () => {
    const addressUsages: AddressUsage[] = [
      { prefix: "tracking", version: "v1", address: 0, count: 100 },
    ];
    const result = analyzeSimplification(graph, "tracking", [], addressUsages, { addressSpaceSize: 1000 });
    expect(result.addressSpaceSize).toBe(1000);
    expect(result.utilizationRate).toBe(1 / 1000);
  });

  it("scanAllSimplifications — 여러 prefix 일괄", () => {
    const results = scanAllSimplifications(graph, ["tracking", "permission"], [], []);
    expect(results).toHaveLength(2);
    expect(results[0].prefix).toBe("tracking");
    expect(results[1].prefix).toBe("permission");
  });
});

// ═══════════════════════════════════════════════════════════════
//  BoundaryRecommender
// ═══════════════════════════════════════════════════════════════

describe("BoundaryRecommender", () => {
  it("split 후보에서 경계 추천", () => {
    const domain: DomainNode = {
      kind: "domain", id: "test-domain", name: "test",
      prefixes: ["tracking"], sharedAxes: [],
      boundary: { exports: ["tracking"], internal: [] },
    };
    graph.addNode(domain);
    graph.addEdge("contains", "test-domain", "tracking");

    const candidate = analyzeSimplification(graph, "tracking", [], []);
    // 차원이 3개이므로 split은 안 나옴. 수동으로 split candidate 생성
    const fakeSplit = {
      ...candidate,
      suggestions: [{ kind: "split-prefix" as const, newPrefixes: [] as string[], reason: "test" }],
    };

    const rec = recommendFromSimplification(graph, fakeSplit);
    expect(rec).toBeDefined();
    expect(rec!.suggestedDomain).toBe("test-domain");
    expect(rec!.relatedPrefixes[0].relation).toBe("splits-from");
  });

  it("매핑 안 되는 축 → 새 경계 추천", () => {
    const rec = recommendFromObservation(graph, ["severity", "urgency"], "order_event");
    expect(rec).toBeDefined();
    expect(rec!.suggestedDims).toContain("severity");
    expect(rec!.relatedPrefixes[0].id).toBe("order_event");
    expect(rec!.relatedPrefixes[0].relation).toBe("extends");
  });

  it("관련 prefix 없으면 independent", () => {
    const rec = recommendFromObservation(graph, ["brand_new_dim"]);
    expect(rec).toBeDefined();
    expect(rec!.relatedPrefixes).toHaveLength(0);
    expect(rec!.confidence).toBe("low");
  });

  it("recommendAll — 여러 소스 통합 + 중복 제거", () => {
    const domain: DomainNode = {
      kind: "domain", id: "test-domain-2", name: "test",
      prefixes: ["tracking"], sharedAxes: [],
      boundary: { exports: ["tracking"], internal: [] },
    };
    graph.addNode(domain);
    graph.addEdge("contains", "test-domain-2", "tracking");

    const fakeSplit = {
      prefix: "tracking", addressSpaceSize: 100, activeAddressCount: 5,
      utilizationRate: 0.05, singleValueDims: [], lowUsageEntries: [],
      suggestions: [{ kind: "split-prefix" as const, newPrefixes: [] as string[], reason: "test" }],
    };

    const recs = recommendAll(graph, {
      simplifications: [fakeSplit],
      unmappedAxes: ["severity"],
    });

    expect(recs.length).toBeGreaterThanOrEqual(1);
    // splits-from과 unmapped 모두 포함
    const relations = recs.flatMap(r => r.relatedPrefixes.map(p => p.relation));
    expect(relations).toContain("splits-from");
  });
});

// ═══════════════════════════════════════════════════════════════
//  ConvergenceRunner (오케스트레이터)
// ═══════════════════════════════════════════════════════════════

describe("ConvergenceRunner", () => {
  it("usage 없으면 구조 분석만", () => {
    const report = runConvergenceAnalysis(graph, null, { date: "2026-03-21" });
    expect(report.causalCandidates).toHaveLength(0);
    expect(report.simplifications).toHaveLength(0);
    expect(report.decisionConflicts).toBeDefined();
    expect(report.summary).toBeDefined();
  });

  it("usage 있으면 전체 파이프라인 실행", () => {
    const usage: UsageData = {
      entryUsages: [
        { axisId: "trackAction", entry: "click", count: 5000, lastSeen: "2026-03-20" },
      ],
      addressUsages: [
        { prefix: "tracking", version: "v1", address: 0, count: 100 },
      ],
      coOccurrences: [{
        sourcePrefix: "auth_event", sourceEntry: "login",
        targetPrefix: "auth_event", targetEntry: "token_refresh",
        count: 15000, totalSourceCount: 15200,
      }],
      collectionPeriod: { from: "2026-03-01", to: "2026-03-21" },
      versionUsages: [],
    };

    const report = runConvergenceAnalysis(graph, usage, { date: "2026-03-21" });
    expect(report.causalCandidates).toHaveLength(1);
    expect(report.observations.length).toBeGreaterThanOrEqual(1);
    expect(report.simplifications.length).toBeGreaterThan(0);
    expect(report.summary).toContain("인과 후보");
  });
});
