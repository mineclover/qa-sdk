/**
 * 계층 구조 테스트 — contains 기반 묶음 + 교집합 + 상속
 *
 * 시나리오: 플랫폼 > 결제 시스템 > gate/checkout 하위 시스템
 *
 * platform (flow/overview, tags: [security])
 *   ├── contains → payment-system (flow/overview)
 *   │    ├── contains → gate-system (flow/overview)
 *   │    │    ├── contains → gate-api (interface/specification)
 *   │    │    ├── contains → gate-state (state/specification)
 *   │    │    └── contains → gate-constraint (constraint/specification, tags: [performance])
 *   │    ├── contains → checkout-system (flow/overview)
 *   │    │    ├── contains → checkout-api (interface/specification)
 *   │    │    └── contains → checkout-flow (flow/specification)
 *   │    └── contains → record-spec (data/specification, tags: [migration])
 *   └── contains → auth-system (flow/overview)
 *        └── contains → auth-api (interface/specification)
 *
 * 교집합: record-spec은 payment-system과 auth-system 모두에 포함
 *   auth-system ── contains → record-spec
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryDefinitionRegistry } from "./registry.js";
import { computeEffectiveConcerns } from "./concern.js";
import type { DefinitionEntryInput } from "./types.js";

const NOW = "2026-03-25T12:00:00Z";

function doc(o: Partial<DefinitionEntryInput> & Pick<DefinitionEntryInput, "id" | "title" | "scope" | "aspect" | "depth">): DefinitionEntryInput {
  return { lifecycle: "approved", createdAt: NOW, updatedAt: NOW, ...o };
}

let reg: MemoryDefinitionRegistry;

function compute(id: string) {
  return computeEffectiveConcerns(id, i => reg.get(i), (i, d) => reg.getLinks(i, d));
}

function containsDepth(id: string): number {
  // contains 체인을 올라가며 깊이 계산
  let depth = 0;
  let current = id;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const incoming = reg.getLinks(current, "incoming");
    const parent = incoming.find(l => l.linkType === "contains");
    if (!parent) break;
    current = parent.sourceId;
    depth++;
  }
  return depth;
}

function getMembers(groupId: string): string[] {
  return reg.getLinks(groupId, "outgoing")
    .filter(l => l.linkType === "contains")
    .map(l => l.targetId);
}

function getParentGroups(memberId: string): string[] {
  return reg.getLinks(memberId, "incoming")
    .filter(l => l.linkType === "contains")
    .map(l => l.sourceId);
}

beforeEach(() => {
  reg = new MemoryDefinitionRegistry();

  // ── 그룹 (overview depth) ──────────────────────────────
  reg.register(doc({ id: "platform", title: "플랫폼", scope: "flow", aspect: "process_flow", depth: "overview", tags: ["security"] }));
  reg.register(doc({ id: "payment-system", title: "결제 시스템", scope: "flow", aspect: "process_flow", depth: "overview" }));
  reg.register(doc({ id: "gate-system", title: "Gate 시스템", scope: "flow", aspect: "process_flow", depth: "overview" }));
  reg.register(doc({ id: "checkout-system", title: "결제 흐름 시스템", scope: "flow", aspect: "process_flow", depth: "overview" }));
  reg.register(doc({ id: "auth-system", title: "인증 시스템", scope: "flow", aspect: "process_flow", depth: "overview" }));

  // ── 원자 (specification/validation depth) ──────────────
  reg.register(doc({ id: "gate-api", title: "Gate API", scope: "interface", aspect: "api_contract", depth: "specification" }));
  reg.register(doc({ id: "gate-state", title: "Gate 상태 모델", scope: "state", aspect: "domain_state", depth: "specification" }));
  reg.register(doc({ id: "gate-constraint", title: "Gate 제약", scope: "constraint", aspect: "tech_constraint", depth: "specification", tags: ["performance"] }));
  reg.register(doc({ id: "checkout-api", title: "Checkout API", scope: "interface", aspect: "api_contract", depth: "specification" }));
  reg.register(doc({ id: "checkout-flow", title: "Checkout 흐름", scope: "flow", aspect: "process_flow", depth: "specification" }));
  reg.register(doc({ id: "record-spec", title: "EventRecord 스키마", scope: "data", aspect: "domain_data", depth: "specification", tags: ["migration"] }));
  reg.register(doc({ id: "auth-api", title: "Auth API", scope: "interface", aspect: "api_contract", depth: "specification" }));

  // ── contains 관계 (계층) ───────────────────────────────
  reg.link("platform", "payment-system", "contains");
  reg.link("platform", "auth-system", "contains");
  reg.link("payment-system", "gate-system", "contains");
  reg.link("payment-system", "checkout-system", "contains");
  reg.link("payment-system", "record-spec", "contains");
  reg.link("gate-system", "gate-api", "contains");
  reg.link("gate-system", "gate-state", "contains");
  reg.link("gate-system", "gate-constraint", "contains");
  reg.link("checkout-system", "checkout-api", "contains");
  reg.link("checkout-system", "checkout-flow", "contains");
  reg.link("auth-system", "auth-api", "contains");

  // 교집합: record-spec은 auth-system에도 포함
  reg.link("auth-system", "record-spec", "contains");
});

// ─── 패턴 1: 묶음 (composition) ─────────────────────────

describe("패턴 1: 묶음 (composition)", () => {
  it("platform의 직접 멤버 2건", () => {
    expect(getMembers("platform").sort()).toEqual(["auth-system", "payment-system"]);
  });

  it("gate-system의 직접 멤버 3건", () => {
    expect(getMembers("gate-system").sort()).toEqual(["gate-api", "gate-constraint", "gate-state"]);
  });

  it("계층 깊이: platform=0, payment-system=1, gate-system=2, gate-api=3", () => {
    expect(containsDepth("platform")).toBe(0);
    expect(containsDepth("payment-system")).toBe(1);
    expect(containsDepth("gate-system")).toBe(2);
    expect(containsDepth("gate-api")).toBe(3);
  });

  it("원자에서 루트까지 역추적", () => {
    // gate-api → gate-system → payment-system → platform
    let current = "gate-api";
    const path: string[] = [current];
    while (true) {
      const parents = getParentGroups(current);
      if (parents.length === 0) break;
      current = parents[0];
      path.push(current);
    }
    expect(path).toEqual(["gate-api", "gate-system", "payment-system", "platform"]);
  });
});

// ─── 패턴 2: 교집합 (intersection) ──────────────────────

describe("패턴 2: 교집합 (intersection)", () => {
  it("record-spec은 2개 그룹에 소속 (DAG)", () => {
    const parents = getParentGroups("record-spec");
    expect(parents.sort()).toEqual(["auth-system", "payment-system"]);
  });

  it("payment-system과 auth-system의 공유 멤버 = record-spec", () => {
    const paymentMembers = new Set(getMembers("payment-system"));
    const authMembers = new Set(getMembers("auth-system"));
    const intersection = [...paymentMembers].filter(m => authMembers.has(m));
    expect(intersection).toEqual(["record-spec"]);
  });
});

// ─── 패턴 3: 상속 (inherited constraint via contains) ────

describe("패턴 3: 상속 (contains 전파)", () => {
  it("platform의 security가 payment-system에 전파", () => {
    const c = compute("payment-system");
    expect(c.all).toContain("security");
    expect(c.inherited.some(i => i.concern === "security" && i.from === "platform" && i.via === "contains")).toBe(true);
  });

  it("platform의 security가 gate-system에 2-hop 전파 (platform→payment→gate)", () => {
    const c = compute("gate-system");
    expect(c.all).toContain("security");
    expect(c.inherited.some(i => i.concern === "security" && i.from === "platform")).toBe(true);
  });

  it("platform의 security가 gate-api에 3-hop 전파 (platform→payment→gate→gate-api)", () => {
    const c = compute("gate-api");
    expect(c.all).toContain("security");
    expect(c.inherited.some(i => i.concern === "security" && i.from === "platform")).toBe(true);
    const secPath = c.inherited.find(i => i.concern === "security" && i.from === "platform");
    expect(secPath!.path.length).toBe(4); // gate-api → gate-system → payment-system → platform
  });

  it("platform의 security가 auth-api에도 전파 (platform→auth→auth-api)", () => {
    const c = compute("auth-api");
    expect(c.all).toContain("security");
  });

  it("gate-constraint의 performance가 gate-system에는 전파되지 않음 (contains는 상→하, 하→상 아님)", () => {
    // gate-system --contains--> gate-constraint (performance)
    // contains downstream = 그룹→멤버. 멤버→그룹은 아님.
    const c = compute("gate-system");
    expect(c.all).not.toContain("performance");
  });

  it("record-spec의 migration이 두 그룹 경로에서는 전파 안 됨 (contains는 상→하 only)", () => {
    // record-spec에 migration 직접.
    // payment-system --contains--> record-spec: 이건 상→하이므로 payment-system→record-spec 방향.
    // record-spec 입장에서 payment-system은 부모. contains downstream은 부모→자식이므로
    // payment-system의 concern이 record-spec에 전파되지, record-spec의 concern이 payment에 전파되는 건 아님.
    const c = compute("payment-system");
    expect(c.all).not.toContain("migration");
  });

  it("record-spec: migration 직접 + platform의 security 상속 (2개 그룹 부모 모두에서)", () => {
    const c = compute("record-spec");
    expect(c.direct).toContain("migration");
    expect(c.all).toContain("security");
    // security는 payment-system 또는 auth-system을 거쳐 platform에서 옴
    expect(c.inherited.some(i => i.concern === "security" && i.from === "platform")).toBe(true);
  });
});

// ─── 통합: scope 질의 + 계층 ─────────────────────────────

describe("통합 질의", () => {
  it("scope로 원자만 필터 (그룹 제외)", () => {
    const interfaces = reg.findByScope("interface");
    expect(interfaces.length).toBe(3);
    expect(interfaces.map(e => e.id).sort()).toEqual(["auth-api", "checkout-api", "gate-api"]);
  });

  it("overview depth = 그룹 문서들", () => {
    const groups = reg.query({ depth: "overview" });
    expect(groups.length).toBe(5);
    expect(groups.map(e => e.id).sort()).toEqual([
      "auth-system", "checkout-system", "gate-system", "payment-system", "platform",
    ]);
  });

  it("specification depth = 원자 문서들", () => {
    const atoms = reg.query({ depth: "specification" });
    expect(atoms.length).toBe(7);
  });

  it("security가 전파된 모든 문서", () => {
    const allDocs = reg.all();
    const securityDocs = allDocs.filter(d => {
      const c = compute(d.id);
      return c.all.includes("security");
    });
    // platform(직접) + 그 아래 모든 것
    expect(securityDocs.length).toBe(12); // 전체 12건 (platform + 하위 11건)
  });

  it("통계", () => {
    const s = reg.stats();
    expect(s.totalEntries).toBe(12);
    expect(s.totalLinks).toBe(12); // contains 11건 + 교집합 1건
  });
});
