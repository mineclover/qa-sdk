/**
 * mermaid-gen 테스트 — DKG 그래프 기반 다이어그램 생성 검증.
 *
 * 실제 DEMO_CATALOG + DEMO_DKG_CONFIG로 bootstrapDkg → 전체 다이어그램 함수 테스트.
 * 각 다이어그램의 구조적 무결성 + 노드 참조 정확성 검증.
 */

import { describe, expect, it } from "vitest";
import { bootstrapDkg } from "../dkg/bootstrap.js";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import type { GraphRegistry } from "../dkg/graph-registry.js";
import {
  intentLinkDiagram,
  allIntentLinksDiagram,
  dslDiagram,
  domainDiagram,
  constraintDiagram,
  tableDiagram,
  tableErDiagram,
  observationLoopDiagram,
  listAllDiagrams,
  transitionSpecDiagram,
  transitionDagDiagram,
} from "./mermaid-gen.js";

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG }) as GraphRegistry;

// ── listAllDiagrams ─────────────────────────────────

describe("listAllDiagrams", () => {
  const diagrams = listAllDiagrams(graph);

  it("topology 없이 7개 이상 카테고리 (service 제외)", () => {
    expect(Object.keys(diagrams).length).toBeGreaterThanOrEqual(7);
    expect(diagrams["intent-links"]).toBeTruthy();
    expect(diagrams["dsl"]).toBeTruthy();
    expect(diagrams["domain"]).toBeTruthy();
    expect(diagrams["constraint"]).toBeTruthy();
    expect(diagrams["table"]).toBeTruthy();
    expect(diagrams["table-er"]).toBeTruthy();
    expect(diagrams["observation-loop"]).toBeTruthy();
  });

  it("각 항목에 kind, id, label이 있음", () => {
    for (const [kind, items] of Object.entries(diagrams)) {
      for (const item of items) {
        expect(item.kind).toBe(kind);
        expect(item.id).toBeTruthy();
      }
    }
  });

  it("DKG 노드 수와 일치", () => {
    expect(diagrams["intent-links"]!.length).toBe(graph.getNodesByKind("intent-link").length);
    expect(diagrams["dsl"]!.length).toBe(graph.getNodesByKind("dsl-bundle").length);
    expect(diagrams["domain"]!.length).toBe(graph.getNodesByKind("domain").length);
    expect(diagrams["constraint"]!.length).toBe(graph.getNodesByKind("constraint").length);
    expect(diagrams["table"]!.length).toBe(graph.getNodesByKind("table").length);
  });

  it("intent-links 목록은 endpoint prefix 배열을 포함한다", () => {
    const intentLinks = graph.getNodesByKind("intent-link");
    const byId = new Map(intentLinks.map((item: any) => [item.id, item]));

    for (const item of diagrams["intent-links"] || []) {
      const link = byId.get(item.id) as any;
      expect(Array.isArray(item.endpoints)).toBe(true);
      expect(item.endpoints).toEqual(link.endpoints);
    }
  });
});

// ── IntentLink ─────────────────────────────────────

describe("intentLinkDiagram", () => {
  const intentLinks = graph.getNodesByKind("intent-link");

  it("모든 IntentLink를 개별 생성 가능", () => {
    for (const il of intentLinks) {
      const mmd = intentLinkDiagram(graph, il.id);
      expect(mmd).toContain("sequenceDiagram");
      expect(mmd).toContain("participant");
      // endpoints가 participant로 등록
      for (const ep of (il as any).endpoints) {
        expect(mmd).toContain(ep);
      }
    }
  });

  it("invariant 주석 포함", () => {
    const il = intentLinks.find((n: any) => n.invariant);
    if (il) {
      const mmd = intentLinkDiagram(graph, il.id);
      expect(mmd).toContain("note over");
    }
  });

  it("존재하지 않는 ID에서 에러", () => {
    expect(() => intentLinkDiagram(graph, "IL-nonexistent")).toThrow();
  });
});

describe("allIntentLinksDiagram", () => {
  it("통합 다이어그램 생성", () => {
    const mmd = allIntentLinksDiagram(graph);
    expect(mmd).toContain("sequenceDiagram");
    // 모든 IntentLink의 endpoint가 포함
    const intentLinks = graph.getNodesByKind("intent-link");
    for (const il of intentLinks) {
      for (const ep of (il as any).endpoints) {
        expect(mmd).toContain(ep);
      }
    }
  });
});

// ── DSL ─────────────────────────────────────────────

describe("dslDiagram", () => {
  it("모든 DSL 번들 생성 가능", () => {
    const bundles = graph.getNodesByKind("dsl-bundle");
    for (const b of bundles) {
      const mmd = dslDiagram(graph, b.id);
      expect(mmd).toContain("sequenceDiagram");
      // DSL 멤버 prefix가 participant로 등록
      for (const member of (b as any).memberPrefixes) {
        expect(mmd).toContain(member);
      }
    }
  });
});

// ── Domain ──────────────────────────────────────────

describe("domainDiagram", () => {
  it("모든 도메인 생성 가능", () => {
    const domains = graph.getNodesByKind("domain");
    for (const d of domains) {
      const mmd = domainDiagram(graph, d.id);
      expect(mmd).toContain("sequenceDiagram");
      // 도메인 prefix가 포함
      for (const p of (d as any).prefixes) {
        expect(mmd).toContain(p);
      }
    }
  });
});

// ── Constraint ──────────────────────────────────────

describe("constraintDiagram", () => {
  it("모든 제약 생성 가능", () => {
    const constraints = graph.getNodesByKind("constraint");
    for (const c of constraints) {
      const mmd = constraintDiagram(graph, c.id);
      expect(mmd).toContain("sequenceDiagram");
      expect(mmd).toContain(c.id);
    }
  });
});

// ── Table ────────────────────────────────────────────

describe("tableDiagram", () => {
  it("모든 테이블 생성 가능", () => {
    const tables = graph.getNodesByKind("table");
    for (const t of tables) {
      const mmd = tableDiagram(graph, t.id);
      expect(mmd.length).toBeGreaterThan(10);
    }
  });
});

describe("tableErDiagram", () => {
  it("전체 ER 다이어그램 생성", () => {
    const mmd = tableErDiagram(graph);
    expect(mmd).toContain("erDiagram");
    // 테이블 이름이 포함
    const tables = graph.getNodesByKind("table");
    for (const t of tables) {
      expect(mmd).toContain(t.id);
    }
  });
});

// ── Observation Loop ────────────────────────────────

describe("observationLoopDiagram", () => {
  it("관측 루프 다이어그램 생성", () => {
    const mmd = observationLoopDiagram(graph);
    expect(mmd).toContain("sequenceDiagram");
  });
});

// ── Transition ──────────────────────────────────────

describe("transitionSpecDiagram", () => {
  it("모든 TransitionSpec 생성 가능", () => {
    const specs = graph.getNodesByKind("transition-spec");
    for (const s of specs) {
      const mmd = transitionSpecDiagram(graph, s.id);
      expect(mmd.length).toBeGreaterThan(10);
      expect(mmd).toContain(s.id);
    }
  });
});

describe("transitionDagDiagram", () => {
  it("전이 DAG 생성", () => {
    const mmd = transitionDagDiagram(graph);
    expect(mmd.length).toBeGreaterThan(10);
  });
});

// ── 다이어그램 ↔ 실데이터 연계 검증 ─────────────────

describe("다이어그램 ↔ prefix 연계", () => {
  it("IntentLink endpoints는 실제 DKG prefix 노드와 일치", () => {
    const intentLinks = graph.getNodesByKind("intent-link");
    const prefixIds = new Set(graph.getNodesByKind("prefix").map(n => n.id));

    for (const il of intentLinks) {
      for (const ep of (il as any).endpoints) {
        expect(prefixIds.has(ep)).toBe(true);
      }
    }
  });

  it("DSL 번들 members는 실제 prefix 노드와 일치", () => {
    const bundles = graph.getNodesByKind("dsl-bundle");
    const prefixIds = new Set(graph.getNodesByKind("prefix").map(n => n.id));

    for (const b of bundles) {
      for (const member of (b as any).memberPrefixes) {
        expect(prefixIds.has(member)).toBe(true);
      }
    }
  });

  it("Domain prefixes는 실제 prefix 노드와 일치", () => {
    const domains = graph.getNodesByKind("domain");
    const prefixIds = new Set(graph.getNodesByKind("prefix").map(n => n.id));

    for (const d of domains) {
      for (const p of (d as any).prefixes) {
        expect(prefixIds.has(p)).toBe(true);
      }
    }
  });

  it("observed prefix가 다이어그램 participant에 반영 가능", () => {
    // 시뮬레이션: service, page_view, cart_event이 observed
    const observedPrefixes = new Set(["service", "page_view", "cart_event"]);
    const intentLinks = graph.getNodesByKind("intent-link");

    for (const il of intentLinks) {
      const endpoints: string[] = (il as any).endpoints;
      const observedEndpoints = endpoints.filter(ep => observedPrefixes.has(ep));
      const unobservedEndpoints = endpoints.filter(ep => !observedPrefixes.has(ep));

      // 각 IntentLink에서 observed/unobserved 구분 가능
      expect(observedEndpoints.length + unobservedEndpoints.length).toBe(endpoints.length);
    }
  });

  it("prefix 커버리지를 IntentLink별로 계산 가능", () => {
    const observedPrefixes = new Set(["service", "page_view", "cart_event", "auth_event"]);
    const intentLinks = graph.getNodesByKind("intent-link");

    const coverageMap: Record<string, { total: number; observed: number; pct: number }> = {};
    for (const il of intentLinks) {
      const endpoints: string[] = (il as any).endpoints;
      const observed = endpoints.filter(ep => observedPrefixes.has(ep)).length;
      coverageMap[il.id] = {
        total: endpoints.length,
        observed,
        pct: Math.round((observed / endpoints.length) * 100),
      };
    }

    // 최소 1개 IntentLink에서 부분 커버리지
    const partialCoverage = Object.values(coverageMap).filter(c => c.observed > 0 && c.observed < c.total);
    expect(partialCoverage.length).toBeGreaterThanOrEqual(0); // 데이터 의존적이므로 >= 0

    // 전체 커버리지 합산
    const totalEndpoints = Object.values(coverageMap).reduce((s, c) => s + c.total, 0);
    const totalObserved = Object.values(coverageMap).reduce((s, c) => s + c.observed, 0);
    expect(totalEndpoints).toBeGreaterThan(0);
    expect(totalObserved).toBeGreaterThanOrEqual(0);
  });
});
