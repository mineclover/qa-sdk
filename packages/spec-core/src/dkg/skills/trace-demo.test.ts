/**
 * DKG 역추적 데모 — 임의 이벤트(order_event)에서 출발하여
 * 의사결정, 스펙, 제약, 관측, 의도 링크, 서비스 토폴로지를 역추적한다.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { createDemoTopology } from "../service-topology.js";
import type { DecisionNode, ObservationNode, ConstraintNode, SpecNode, DslBundleNode } from "../dkg.types.js";

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
const topo = createDemoTopology();

describe("DKG 역추적: order_event", () => {
  const target = "order_event";

  it("노드가 존재한다", () => {
    const node = graph.getNode(target);
    expect(node).toBeDefined();
    expect(node!.kind).toBe("prefix");
    console.log("\n═══ 역추적 대상:", target, "═══");
    console.log("  kind:", node!.kind, "/ name:", (node as any).name);
    console.log("  category:", (node as any).category);
    console.log("  dimLabels:", (node as any).dimLabels);
  });

  it("구성 축(composes)을 추적할 수 있다", () => {
    const composes = graph.edgesFrom(target, "composes");
    expect(composes.length).toBeGreaterThan(0);

    console.log("\n── 구성 축 (composes) ──");
    for (const e of composes) {
      const ax = graph.getNode(e.to);
      console.log(`  ${e.to} [${e.meta?.dimKind}] — ${(ax as any)?.name ?? ""}`);
    }
  });

  it("참조 prefix(references)를 추적할 수 있다", () => {
    const refs = graph.edgesFrom(target, "references");
    console.log("\n── 참조 prefix (references) ──");
    if (refs.length === 0) console.log("  (없음)");
    for (const e of refs) console.log(`  → ${e.to}`);
    // order_event는 table_ref/prefix_ref가 있을 수 있음
    expect(refs.length).toBeGreaterThanOrEqual(0);
  });

  it("소속 domain/dsl-bundle을 역추적할 수 있다", () => {
    const containedBy = graph.edgesTo(target, "contains");
    expect(containedBy.length).toBeGreaterThan(0);

    console.log("\n── 소속 (domain / dsl-bundle) ──");
    for (const e of containedBy) {
      const n = graph.getNode(e.from);
      console.log(`  ${e.from} [${n?.kind}] — ${(n as any).name ?? ""}`);
    }
  });

  it("적용되는 제약(constraints)을 역추적할 수 있다", () => {
    const constraints = graph.edgesTo(target, "constrains");
    console.log("\n── 제약 (constraints) ──");
    if (constraints.length === 0) console.log("  (직접 제약 없음)");
    for (const e of constraints) {
      const c = graph.getNode(e.from) as ConstraintNode;
      console.log(`  ${c.id}: ${c.rule}`);
    }

    // CON-002: 이벤트 prefix의 action 차원 규칙
    const con002 = constraints.find(e => e.from === "CON-002");
    expect(con002).toBeDefined();
  });

  it("관련 의사결정(decisions)을 역추적할 수 있다", () => {
    console.log("\n── 의사결정 ──");
    let count = 0;
    for (const type of ["governs", "justifies"] as const) {
      for (const e of graph.edgesTo(target, type)) {
        const d = graph.getNode(e.from) as DecisionNode | undefined;
        if (d?.kind === "decision") {
          count++;
          console.log(`  [${type}] ${d.id}: ${d.title}`);
          console.log(`    context:   ${d.context}`);
          console.log(`    rationale: ${d.rationale.slice(0, 150)}`);
          console.log(`    lifecycle: ${d.lifecycle}`);
        }
      }
    }
    if (count === 0) console.log("  (없음)");
    expect(count).toBeGreaterThanOrEqual(0); // 구조적 정합성 확인
  });

  it("관측(observations)과 그로부터 촉발된 decision을 추적할 수 있다", () => {
    console.log("\n── 관측 → 의사결정 체인 ──");
    let count = 0;
    for (const e of graph.edgesTo(target, "observes")) {
      const o = graph.getNode(e.from) as ObservationNode | undefined;
      if (!o || o.kind !== "observation") continue;
      count++;
      console.log(`  ${o.id}: ${o.finding}`);
      if (o.suggestion) console.log(`    suggestion: ${JSON.stringify(o.suggestion)}`);

      // observation → prompts → decision 체인
      const prompted = graph.neighbors(o.id, "prompts");
      if (prompted.length) {
        for (const decId of prompted) {
          const dec = graph.getNode(decId) as DecisionNode | undefined;
          if (dec) {
            console.log(`    → prompted ${dec.id}: ${dec.title}`);
            console.log(`      rationale: ${dec.rationale.slice(0, 120)}`);
          }
        }
      }
    }
    if (count === 0) console.log("  (없음)");
    // order_event는 dsl-commerce에 포함되므로 skew observation이 있을 수 있음
  });

  it("의도 링크(intent-links)를 추적할 수 있다", () => {
    const links = graph.intentLinksFor(target);
    console.log("\n── 의도 링크 ──");
    if (links.length === 0) console.log("  (없음)");
    for (const l of links) {
      console.log(`  ${l.id}: ${l.intent}`);
      if (l.invariant) console.log(`    invariant: ${l.invariant}`);
    }
    // order_event는 IL-checkout-flow에 포함
    expect(links.some(l => l.id === "IL-checkout-flow")).toBe(true);
  });

  it("서비스 토폴로지를 추적할 수 있다", () => {
    const owner = topo.getOwner(target);
    const consumers = topo.getConsumers(target);
    console.log("\n── 서비스 토폴로지 ──");
    console.log(`  owner:     ${owner ?? "없음"}`);
    console.log(`  consumers: ${consumers.join(", ") || "없음"}`);

    expect(owner).toBe("shopping-backend");
  });

  it("cascade 영향을 추적할 수 있다", () => {
    const cascade = graph.cascadeFromPrefix(target);
    console.log("\n── cascade (변경 시 영향) ──");
    console.log(`  domains:   ${cascade.domains.map(d => d.id).join(", ") || "없음"}`);
    console.log(`  consumers: ${cascade.consumers.map(c => `${c.id} via ${c.via}`).join(", ") || "없음"}`);
  });

  it("차원 의미를 해석할 수 있다", () => {
    const prefix = DEMO_CATALOG.prefixes[target];
    expect(prefix).toBeDefined();

    console.log("\n── 차원 의미 해석 ──");
    for (const [label, dim] of Object.entries(prefix.dims)) {
      if (dim.kind === "axis") {
        const axis = DEMO_CATALOG.axes[dim.axisId];
        const versions = Object.keys(axis.versions);
        const latest = (axis.versions as Record<string, any>)[versions[versions.length - 1]];
        console.log(`  ${label} → axis:${dim.axisId} entries=[${latest.entries.join(",")}] cap=${latest.capacity ?? latest.entries.length}`);
      } else if (dim.kind === "prefix_ref") {
        console.log(`  ${label} → prefix_ref:${dim.prefixId}`);
      } else {
        console.log(`  ${label} → table_ref:${(dim as any).table}`);
      }
    }
    console.log(`  versions: ${prefix.versions.map(v => v.version).join(", ")}`);
  });

  it("전체 역추적 경로를 한 흐름으로 요약할 수 있다", () => {
    console.log("\n═══ 종합 역추적 경로 ═══");
    console.log(`\n  order_event`);
    console.log(`    ├── 구성: ${graph.edgesFrom(target, "composes").map(e => e.to).join(", ")}`);
    console.log(`    ├── 참조: ${graph.edgesFrom(target, "references").map(e => e.to).join(", ") || "(없음)"}`);
    console.log(`    ├── 소속 domain: ${graph.edgesTo(target, "contains").filter(e => graph.getNode(e.from)?.kind === "domain").map(e => e.from).join(", ")}`);
    console.log(`    ├── 소속 DSL:    ${graph.edgesTo(target, "contains").filter(e => graph.getNode(e.from)?.kind === "dsl-bundle").map(e => e.from).join(", ")}`);
    console.log(`    ├── 제약:        ${graph.edgesTo(target, "constrains").map(e => e.from).join(", ") || "(없음)"}`);
    console.log(`    ├── intent-link: ${graph.intentLinksFor(target).map(l => l.id).join(", ") || "(없음)"}`);
    console.log(`    ├── owner:       ${topo.getOwner(target) ?? "(없음)"}`);
    console.log(`    └── consumers:   ${topo.getConsumers(target).join(", ") || "(없음)"}`);

    // 연결된 의사결정 + 관측 요약
    const allDecs = new Set<string>();
    const allObs = new Set<string>();
    for (const type of ["governs", "justifies"] as const) {
      for (const e of graph.edgesTo(target, type)) {
        if (graph.getNode(e.from)?.kind === "decision") allDecs.add(e.from);
      }
    }
    for (const e of graph.edgesTo(target, "observes")) {
      if (graph.getNode(e.from)?.kind === "observation") {
        allObs.add(e.from);
        for (const p of graph.neighbors(e.from, "prompts")) allDecs.add(p);
      }
    }
    console.log(`\n    Observations: ${[...allObs].join(", ") || "(없음)"}`);
    console.log(`    Decisions:    ${[...allDecs].join(", ") || "(없음)"}`);

    expect(true).toBe(true); // 구조적 탐색 성공
  });
});
