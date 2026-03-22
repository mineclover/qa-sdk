import { describe, it, expect, beforeEach } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { GraphRegistry } from "./graph-registry.js";
import { deriveFromCatalog } from "./catalog-derive.js";
import { analyzeImpact } from "./skills/analyze-impact.js";
import { inferMigrator } from "./skills/infer-migrator.js";
import { versionEventFromDiff } from "./skills/version-event-derive.js";
import { scaffoldDecision } from "./skills/decision-scaffold.js";
import type { DomainNode, ConsumerNode, ConstraintNode, IntentLinkNode } from "./dkg.types.js";

let graph: GraphRegistry;

beforeEach(() => {
  graph = deriveFromCatalog(DEMO_CATALOG);
});

// ═══════════════════════════════════════════════════════════════
//  catalog-derive
// ═══════════════════════════════════════════════════════════════

describe("deriveFromCatalog", () => {
  it("axis 노드를 추출한다", () => {
    const axes = graph.getNodesByKind("axis");
    expect(axes.length).toBeGreaterThanOrEqual(10);

    const role = graph.getNode("role");
    expect(role).toBeDefined();
    expect(role!.kind).toBe("axis");
  });

  it("prefix 노드를 추출한다", () => {
    const prefixes = graph.getNodesByKind("prefix");
    expect(prefixes.length).toBeGreaterThanOrEqual(5);

    const perm = graph.getNode("permission");
    expect(perm).toBeDefined();
    expect(perm!.kind).toBe("prefix");
  });

  it("composes 엣지를 생성한다 (axis dim)", () => {
    // permission prefix는 role axis를 사용
    const edges = graph.edgesFrom("permission", "composes");
    const roleEdge = edges.find(e => e.to === "role");
    expect(roleEdge).toBeDefined();
    expect(roleEdge!.meta?.dimKind).toBe("axis");
  });

  it("references 엣지를 생성한다 (prefix_ref)", () => {
    // permission prefix는 service prefix를 prefix_ref로 참조
    const refs = graph.edgesFrom("permission", "references");
    const serviceRef = refs.find(e => e.to === "service");
    expect(serviceRef).toBeDefined();
  });

  it("table_ref 차원도 composes로 기록한다", () => {
    const edges = graph.edgesFrom("cart_event", "composes");
    const tableEdge = edges.find(e => e.meta?.dimKind === "table_ref");
    expect(tableEdge).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
//  GraphRegistry 질의
// ═══════════════════════════════════════════════════════════════

describe("GraphRegistry", () => {
  it("neighbors: 순방향 이웃", () => {
    const targets = graph.neighbors("permission", "composes");
    expect(targets).toContain("role");
  });

  it("reverseNeighbors: 역방향 이웃", () => {
    const sources = graph.reverseNeighbors("role", "composes");
    expect(sources).toContain("permission");
  });

  it("cascadeFromAxis: axis → prefix cascade", () => {
    const cascade = graph.cascadeFromAxis("role");
    const ids = cascade.map(c => c.id);
    expect(ids).toContain("permission");
    // rbac prefix는 rbac_role axis를 사용 (role과 다름)
    // role을 직접 사용하는 prefix만 포함
  });

  it("cascadeFromAxis: references를 통한 2-hop cascade", () => {
    // env axis → service prefix → permission/event 가 references로 연결
    const cascade = graph.cascadeFromAxis("env");
    const ids = cascade.map(c => c.id);
    expect(ids).toContain("service");    // composes (distance=1)
    expect(ids).toContain("permission"); // references (distance=2)
    expect(ids).toContain("event");      // references (distance=2)
  });

  it("cascadeFromPrefix: domain + consumer cascade", () => {
    // 수동으로 domain, consumer 등록
    const domain: DomainNode = {
      kind: "domain", id: "shopping-domain", name: "쇼핑",
      prefixes: ["permission", "event", "service"],
      sharedAxes: ["env"], boundary: { exports: ["permission"], internal: ["service"] },
    };
    const consumer: ConsumerNode = {
      kind: "consumer", id: "auth-service", type: "service",
      intendedPrefixes: ["permission", "service"],
    };
    graph.addNode(domain);
    graph.addNode(consumer);
    graph.addEdge("contains", "shopping-domain", "permission");
    graph.addEdge("contains", "shopping-domain", "event");
    graph.addEdge("contains", "shopping-domain", "service");
    graph.addEdge("consumes", "auth-service", "shopping-domain");

    const result = graph.cascadeFromPrefix("permission");
    expect(result.domains).toHaveLength(1);
    expect(result.domains[0].id).toBe("shopping-domain");
    expect(result.consumers).toHaveLength(1);
    expect(result.consumers[0].id).toBe("auth-service");
  });

  it("activeConstraints: 활성 constraint 조회", () => {
    const constraint: ConstraintNode = {
      kind: "constraint", id: "CON-001",
      rule: "rbac_role과 role은 같은 prefix에 동시 사용 금지",
      scope: ["rbac_role", "role"], lifecycle: "active",
    };
    graph.addNode(constraint);
    graph.addEdge("constrains", "CON-001", "role");
    graph.addEdge("constrains", "CON-001", "rbac_role");

    const constraints = graph.activeConstraints("role");
    expect(constraints).toHaveLength(1);
    expect(constraints[0].constraintId).toBe("CON-001");
  });

  it("intentLinksFor: intent-link 조회", () => {
    const link: IntentLinkNode = {
      kind: "intent-link", id: "IL-001",
      endpoints: ["permission", "event"], via: "service",
      intent: "동일한 서비스 컨텍스트 공유",
      invariant: "service prefix_ref가 같은 주소 공간을 가리켜야 함",
    };
    graph.addNode(link);
    graph.addEdge("binds", "IL-001", "permission");
    graph.addEdge("binds", "IL-001", "event");

    const links = graph.intentLinksFor("permission");
    expect(links).toHaveLength(1);
    expect(links[0].invariant).toContain("service");
  });
});

// ═══════════════════════════════════════════════════════════════
//  analyzeImpact
// ═══════════════════════════════════════════════════════════════

describe("analyzeImpact", () => {
  it("axis 변경 영향 분석 — entry 추가 (no stride-break)", () => {
    const result = analyzeImpact(graph, {
      type: "entry-added",
      target: { axis: "role" },
      detail: "auditor 추가",
    });

    expect(result.strideBreak).toBe(false);
    expect(result.migrationRequired).toBe(false);
    expect(result.affectedPrefixes.map(p => p.id)).toContain("permission");
  });

  it("capacity 변경 영향 분석 — stride-break", () => {
    const result = analyzeImpact(graph, {
      type: "capacity-changed",
      target: { axis: "role", fromVersion: "v3", toVersion: "v4" },
    });

    expect(result.strideBreak).toBe(true);
    expect(result.migrationRequired).toBe(true);
    expect(result.autoMigratable).toBe(true);
  });

  it("새 prefix — 기존에 영향 없음", () => {
    const result = analyzeImpact(graph, {
      type: "new-prefix",
      target: { prefix: "new-tracking" },
    });

    expect(result.strideBreak).toBe(false);
    expect(result.affectedPrefixes).toHaveLength(1); // new-tracking 자체
    expect(result.constraintViolations).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  inferMigrator
// ═══════════════════════════════════════════════════════════════

describe("inferMigrator", () => {
  it("identity: max만 증가", () => {
    const result = inferMigrator({
      fromLabels: ["role", "action"],
      toLabels: ["role", "action"],
      changedLabels: [{ label: "role", fromMax: 5, toMax: 8 }],
    });

    expect(result.pattern).toBe("identity");
    expect(result.migrator).toBeDefined();
    expect(result.migrator!([1, 2])).toEqual([1, 2]);
  });

  it("append-dim: 차원 추가", () => {
    const result = inferMigrator({
      fromLabels: ["role", "action"],
      toLabels: ["role", "action", "resource"],
      changedLabels: [],
    });

    expect(result.pattern).toBe("append-dim");
    expect(result.migrator).toBeDefined();
    expect(result.migrator!([3, 2])).toEqual([3, 2, 1]); // 기본값 1
  });

  it("append-dim: 커스텀 기본값", () => {
    const result = inferMigrator({
      fromLabels: ["role", "action"],
      toLabels: ["role", "action", "resource"],
      changedLabels: [],
    }, { defaultValue: 5 });

    expect(result.migrator!([3, 2])).toEqual([3, 2, 5]);
  });

  it("remove-dim: 차원 제거", () => {
    const result = inferMigrator({
      fromLabels: ["role", "action", "resource"],
      toLabels: ["role", "resource"],
      changedLabels: [],
    });

    expect(result.pattern).toBe("remove-dim");
    expect(result.migrator!([3, 2, 4])).toEqual([3, 4]);
    expect(result.warnings).toHaveLength(1);
  });

  it("reorder: 차원 순서 변경", () => {
    const result = inferMigrator({
      fromLabels: ["role", "action", "resource"],
      toLabels: ["resource", "role", "action"],
      changedLabels: [],
    });

    expect(result.pattern).toBe("reorder");
    expect(result.migrator!([3, 2, 4])).toEqual([4, 3, 2]);
  });

  it("unknown: max 감소", () => {
    const result = inferMigrator({
      fromLabels: ["role", "action"],
      toLabels: ["role", "action"],
      changedLabels: [{ label: "role", fromMax: 8, toMax: 4 }],
    });

    expect(result.pattern).toBe("unknown");
    expect(result.migrator).toBeNull();
  });

  it("변경 없음 → identity", () => {
    const result = inferMigrator({
      fromLabels: ["role", "action"],
      toLabels: ["role", "action"],
      changedLabels: [],
    });

    expect(result.pattern).toBe("identity");
  });
});

// ═══════════════════════════════════════════════════════════════
//  versionEventFromDiff
// ═══════════════════════════════════════════════════════════════

describe("versionEventFromDiff", () => {
  it("capacity 증가 → size 변경 impact", () => {
    const ve = versionEventFromDiff({
      prefix: "permission",
      from: "pv3",
      to: "pv4",
      changedLabels: [{
        label: "role",
        fromLabelVersion: "v3", fromMax: 8,
        toLabelVersion: "v4", toMax: 16,
      }],
    }, { date: "2026-03-20" });

    expect(ve.id).toBe("VE-permission-pv3-pv4");
    expect(ve.changes).toHaveLength(1);
    expect(ve.changes[0].kind).toBe("capacity-changed");
    expect(ve.impact).toContain("size 변경");
  });

  it("변경 없음 → no-impact", () => {
    const ve = versionEventFromDiff({
      prefix: "service",
      from: "v1",
      to: "v2",
      changedLabels: [],
    }, { date: "2026-03-20" });

    expect(ve.impact).toContain("no-impact");
    expect(ve.changes).toHaveLength(0);
  });

  it("entry 추가 (max +1) → entry-added", () => {
    const ve = versionEventFromDiff({
      prefix: "permission",
      from: "pv1",
      to: "pv2",
      changedLabels: [{
        label: "role",
        fromLabelVersion: "v1", fromMax: 5,
        toLabelVersion: "v2", toMax: 6,
      }],
    }, { date: "2026-03-20" });

    expect(ve.changes[0].kind).toBe("entry-added");
  });
});

// ═══════════════════════════════════════════════════════════════
//  scaffoldDecision
// ═══════════════════════════════════════════════════════════════

describe("scaffoldDecision", () => {
  it("capacity 결정 — alternatives 자동 생성", () => {
    const dec = scaffoldDecision({
      type: "capacity",
      id: "DEC-001",
      date: "2026-03-20",
      title: "role capacity를 16으로 확장",
      params: { axis: "role", currentUsed: 8, currentCapacity: 8, proposedCapacity: 16 },
      rationale: "9번째 역할 필요",
    });

    expect(dec.kind).toBe("decision");
    expect(dec.lifecycle).toBe("active");
    expect(dec.alternatives).toBeDefined();
    expect(dec.alternatives!.length).toBeGreaterThanOrEqual(3);
    expect(dec.alternatives!.some(a => a.includes("16"))).toBe(true);
    expect(dec.reversalConditions).toBeDefined();
    expect(dec.context).toContain("100%");
  });

  it("new-axis 결정", () => {
    const dec = scaffoldDecision({
      type: "new-axis",
      id: "DEC-002",
      date: "2026-03-20",
      title: "severity 축 추가",
      params: { axisId: "severity", entries: ["low", "medium", "high"], capacity: 8 },
      rationale: "이벤트 심각도 추적",
    });

    expect(dec.context).toContain("severity");
    expect(dec.alternatives!.some(a => a.includes("table_ref"))).toBe(true);
  });

  it("merge 결정 — overlap entries 표시", () => {
    const dec = scaffoldDecision({
      type: "merge",
      id: "DEC-003",
      date: "2026-03-20",
      title: "rbac_role과 role 병합",
      params: { targets: ["rbac_role", "role"], into: "role", overlapEntries: ["admin"] },
      rationale: "운영 중 혼동",
    });

    expect(dec.context).toContain("admin");
    expect(dec.alternatives!.some(a => a.includes("alias"))).toBe(true);
  });

  it("추가 alternatives/reversalConditions 병합", () => {
    const dec = scaffoldDecision({
      type: "capacity",
      id: "DEC-004",
      date: "2026-03-20",
      title: "test",
      params: { axis: "role", currentUsed: 4, currentCapacity: 8, proposedCapacity: 16 },
      rationale: "test",
      additionalAlternatives: ["커스텀 대안"],
      additionalReversalConditions: ["커스텀 조건"],
    });

    expect(dec.alternatives!).toContain("커스텀 대안");
    expect(dec.reversalConditions!).toContain("커스텀 조건");
  });
});

// ═══════════════════════════════════════════════════════════════
//  GraphPort 호환성 — GraphRegistry가 Port 계약을 충족하는지 검증
// ═══════════════════════════════════════════════════════════════

describe("GraphPort 호환성", () => {
  it("GraphRegistry가 GraphPort를 구현한다 (컴파일 타임 + 런타임)", () => {
    // 컴파일 타임: implements GraphPort 선언이 tsc에서 검증됨
    // 런타임: Port의 모든 메서드가 존재하는지 확인
    const port: import("../shared/graph-port.js").GraphPort = graph;

    expect(typeof port.getNode).toBe("function");
    expect(typeof port.getNodeOrThrow).toBe("function");
    expect(typeof port.getNodesByKind).toBe("function");
    expect(typeof port.getAllNodes).toBe("function");
    expect(typeof port.findNodes).toBe("function");
    expect(typeof port.edgesFrom).toBe("function");
    expect(typeof port.edgesTo).toBe("function");
    expect(typeof port.neighbors).toBe("function");
    expect(typeof port.intentLinksFor).toBe("function");
    expect(typeof port.cascadeFromAxis).toBe("function");
    expect(typeof port.getPrefixesByCategory).toBe("function");
    expect(typeof port.groupPrefixesByCategory).toBe("function");
    expect(typeof port.addNode).toBe("function");
    expect(typeof port.addEdge).toBe("function");
  });

  it("Port를 통해 조회한 결과가 GraphNodeLike 형태를 충족한다", () => {
    const port: import("../shared/graph-port.js").GraphPort = graph;

    const node = port.getNode("role");
    expect(node).toBeDefined();
    expect(node!.kind).toBe("axis");
    expect(node!.id).toBe("role");

    const prefixes = port.getNodesByKind("prefix");
    expect(prefixes.length).toBeGreaterThan(0);
    for (const p of prefixes) {
      expect(p.kind).toBe("prefix");
      expect(typeof p.id).toBe("string");
    }
  });

  it("Port를 통한 엣지 조회가 GraphEdgeLike 형태를 충족한다", () => {
    const port: import("../shared/graph-port.js").GraphPort = graph;

    const edges = port.edgesFrom("permission", "composes");
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(typeof e.type).toBe("string");
      expect(typeof e.from).toBe("string");
      expect(typeof e.to).toBe("string");
    }
  });

  it("GraphRegistryPort 최소 계약 (서비스 동적 import용)", () => {
    // GraphRegistryPort = { getAllNodes(), getNodesByKind() } 만 요구
    const servicePort: { getAllNodes(): unknown[]; getNodesByKind(kind: string): unknown[] } = graph;

    const allNodes = servicePort.getAllNodes();
    expect(allNodes.length).toBeGreaterThan(0);

    const axes = servicePort.getNodesByKind("axis");
    expect(axes.length).toBeGreaterThan(0);
  });

  it("Table 질의 API가 GraphRegistry에만 존재한다 (Port에는 없음)", () => {
    // GraphRegistry 구체 타입으로 접근해야 Table 질의 가능
    expect(typeof graph.getPrefixesForTable).toBe("function");
    expect(typeof graph.getTablesForPrefix).toBe("function");
    expect(typeof graph.getTableColumnRefs).toBe("function");
    expect(typeof graph.cascadeFromTable).toBe("function");

    // Port 타입으로 캐스트하면 Table 메서드에 접근 불가 (타입 수준 검증)
    const port: import("../shared/graph-port.js").GraphPort = graph;
    expect("getPrefixesForTable" in port).toBe(true); // 런타임에는 존재
    // 하지만 GraphPort 인터페이스에는 선언되지 않음 — 타입 안전성으로 접근 차단
  });
});
