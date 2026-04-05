/**
 * 영향 분석 테스트 — 바텀업 역추적
 *
 * gate 시스템에서 리프 문서가 변경될 때
 * 어떤 문서가 영향받는지 역추적한다.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryDefinitionRegistry } from "./registry.js";
import { analyzeImpact } from "./impact.js";
import type { DefinitionEntryInput } from "./types.js";

const NOW = "2026-03-25T12:00:00Z";

function doc(o: Partial<DefinitionEntryInput> & Pick<DefinitionEntryInput, "id" | "title" | "scope" | "aspect" | "depth">): DefinitionEntryInput {
  return { lifecycle: "approved", createdAt: NOW, updatedAt: NOW, ...o };
}

let reg: MemoryDefinitionRegistry;

function impact(id: string) {
  return analyzeImpact(id, i => reg.get(i), (i, d) => reg.getLinks(i, d));
}

beforeEach(() => {
  reg = new MemoryDefinitionRegistry();

  // system-root → gate-system → gate-api, gate-state, gate-constraint
  // gate-flow refines gate-api
  // gate-constraint constrains gate-api
  // checkout-api depends_on gate-api (교차 의존)
  // gate-scenario traces_to gate-api (비전파)

  reg.register(doc({ id: "system-root", title: "시스템", scope: "flow", aspect: "process_flow", depth: "overview", serialized: "def_document:v2:1001" }));
  reg.register(doc({ id: "gate-system", title: "Gate", scope: "flow", aspect: "process_flow", depth: "overview", serialized: "def_document:v2:1002" }));
  reg.register(doc({ id: "gate-api", title: "Gate API", scope: "interface", aspect: "api_contract", depth: "specification", serialized: "def_document:v2:1003" }));
  reg.register(doc({ id: "gate-state", title: "Gate State", scope: "state", aspect: "domain_state", depth: "specification", serialized: "def_document:v2:1004" }));
  reg.register(doc({ id: "gate-constraint", title: "Gate Constraint", scope: "constraint", aspect: "tech_constraint", depth: "specification", serialized: "def_document:v2:1005" }));
  reg.register(doc({ id: "gate-flow", title: "Gate Flow", scope: "flow", aspect: "process_flow", depth: "specification", serialized: "def_document:v2:1006" }));
  reg.register(doc({ id: "checkout-api", title: "Checkout API", scope: "interface", aspect: "api_contract", depth: "specification", serialized: "def_document:v2:1007" }));
  reg.register(doc({ id: "gate-scenario", title: "Gate Scenario", scope: "feature", aspect: "scenario", depth: "validation", serialized: "def_document:v2:1008" }));

  reg.link("system-root", "gate-system", "contains");
  reg.link("gate-system", "gate-api", "contains");
  reg.link("gate-system", "gate-state", "contains");
  reg.link("gate-system", "gate-constraint", "contains");
  reg.link("gate-flow", "gate-api", "refines");
  reg.link("gate-constraint", "gate-api", "constrains");
  reg.link("checkout-api", "gate-api", "depends_on");
  reg.link("gate-scenario", "gate-api", "traces_to");
});

describe("analyzeImpact", () => {
  it("gate-api 변경 → 영향 범위 추적", () => {
    const result = impact("gate-api");

    expect(result.sourceId).toBe("gate-api");
    expect(result.sourceAddress).toBe("def_document:v2:1003");
    expect(result.blastRadius).toBeGreaterThan(0);

    const ids = result.impacted.map(i => i.id);

    // depends_on 역추적: checkout-api가 gate-api에 의존
    expect(ids).toContain("checkout-api");

    // implements/refines 역추적: gate-flow가 gate-api를 refines
    expect(ids).toContain("gate-flow");

    // contains 역추적: gate-system → system-root
    expect(ids).toContain("gate-system");
    expect(ids).toContain("system-root");

    // constrains 역추적: gate-constraint가 gate-api를 constrains → gate-api가 변경되어도 constraint 자체는 영향 아님
    // 하지만 constrains 방향: gate-constraint --constrains--> gate-api
    // gate-api 변경 시 gate-constraint는 incoming constrains의 source이므로 영향 없음
    // (제약이 바뀌면 피제약자가 영향받지, 피제약자가 바뀐다고 제약이 영향받지 않음)
  });

  it("traces_to는 영향 전파하지 않음", () => {
    const result = impact("gate-api");
    const ids = result.impacted.map(i => i.id);
    // gate-scenario는 traces_to로만 연결 → 영향 없음
    expect(ids).not.toContain("gate-scenario");
  });

  it("gate-constraint 변경 → constrains 대상 영향", () => {
    const result = impact("gate-constraint");
    const ids = result.impacted.map(i => i.id);

    // gate-constraint --constrains--> gate-api → gate-api 영향
    expect(ids).toContain("gate-api");

    // gate-api 영향 → 전이: checkout-api, gate-flow, gate-system도 영향
    expect(ids).toContain("checkout-api");
    expect(ids).toContain("gate-system");
  });

  it("gate-state 변경 → contains 역추적만", () => {
    const result = impact("gate-state");
    const ids = result.impacted.map(i => i.id);

    // gate-state에 depends_on/implements/refines incoming이 없음
    // contains 역추적만: gate-system → system-root
    expect(ids).toContain("gate-system");
    expect(ids).toContain("system-root");
    expect(result.blastRadius).toBe(2);
  });

  it("affectedGroups에 그룹 문서만 포함", () => {
    const result = impact("gate-api");
    expect(result.affectedGroups).toContain("gate-system");
    expect(result.affectedGroups).toContain("system-root");
    // 일반 문서는 affectedGroups에 없음
    expect(result.affectedGroups).not.toContain("checkout-api");
  });

  it("영향 경로(path)를 추적할 수 있다", () => {
    const result = impact("gate-api");
    const systemRoot = result.impacted.find(i => i.id === "system-root");
    expect(systemRoot).toBeDefined();
    expect(systemRoot?.address).toBe("def_document:v2:1001");
    // gate-api → gate-system → system-root
    expect(systemRoot!.path).toContain("gate-api");
    expect(systemRoot!.path).toContain("gate-system");
    expect(systemRoot!.path).toContain("system-root");
  });

  it("미등록 문서는 빈 결과", () => {
    const result = impact("nonexistent");
    expect(result.blastRadius).toBe(0);
  });

  it("system-root 변경 → 영향 적음 (최상위)", () => {
    const result = impact("system-root");
    // system-root에 incoming이 없으므로 영향 범위 = 0
    // (contains의 target이 아니라 source이므로)
    expect(result.blastRadius).toBe(0);
  });
});

describe("실제 시나리오: 바텀업 의사결정", () => {
  it("리프에서 변경 → blast radius가 루트로 갈수록 작아진다", () => {
    const leafImpact = impact("gate-api");
    const midImpact = impact("gate-system");
    const rootImpact = impact("system-root");

    expect(leafImpact.blastRadius).toBeGreaterThan(midImpact.blastRadius);
    expect(midImpact.blastRadius).toBeGreaterThanOrEqual(rootImpact.blastRadius);
  });
});
