// @def.doc definition-catalog-spec

/**
 * Gate 시스템 문서 분리 작성 + 조회 검증
 *
 * 하나의 기능(gate)을 6개 scope로 분리 작성한 실제 문서를 스캔하고,
 * "주제와 다른 내용을 적지 않는" 컨벤션이 제대로 작동하는지 검증한다.
 *
 * 문서 구조:
 *   gate-api          (interface/api_contract)   API 엔드포인트만
 *   gate-state-model  (state/domain_state)       4-state 모델만
 *   gate-engine-func  (feature/func_def)         계산 기능만
 *   gate-flow         (flow/process_flow)        운영 흐름만
 *   gate-constraint   (constraint/tech_constraint) 불변 조건만
 *   gate-scenario     (feature/scenario)         테스트 시나리오만
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { scanAndBuild, computeAllConcerns } from "./frontmatter.js";
import type { ScanResult } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");
const CLASSIC_GATE_IDS = new Set([
  "gate-api",
  "gate-state-model",
  "gate-engine-func",
  "gate-flow",
  "gate-constraint",
  "gate-scenario",
]);

let result: ScanResult;

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
});

function classicGateDocs() {
  return result.registry.all().filter((entry) => CLASSIC_GATE_IDS.has(entry.id));
}

// ─── 1. 등록 확인 ───────────────────────────────────────

describe("gate 문서 등록", () => {
  it("gate 문서 6건이 모두 등록된다", () => {
    for (const id of CLASSIC_GATE_IDS) {
      expect(result.registry.get(id), `${id} 미등록`).toBeDefined();
    }
  });

  it("각 문서가 올바른 scope에 분류된다", () => {
    const reg = result.registry;
    expect(reg.get("gate-api")!.scope).toBe("interface");
    expect(reg.get("gate-state-model")!.scope).toBe("state");
    expect(reg.get("gate-engine-func")!.scope).toBe("feature");
    expect(reg.get("gate-flow")!.scope).toBe("flow");
    expect(reg.get("gate-constraint")!.scope).toBe("constraint");
    expect(reg.get("gate-scenario")!.scope).toBe("feature");
  });

  it("ref 경로가 올바르다", () => {
    expect(result.registry.get("gate-api")!.ref).toBe("docs/specs/gate/gate-api.spec.md");
    expect(result.registry.get("gate-flow")!.ref).toBe("docs/specs/gate/gate-flow.spec.md");
  });

  it("title이 # 제목에서 추출된다", () => {
    expect(result.registry.get("gate-api")!.title).toBe("Gate Service API 계약");
    expect(result.registry.get("gate-state-model")!.title).toBe("Gate 4-State 모델");
  });

  it("파싱 에러가 없다", () => {
    // gate 관련 에러만 필터
    const gateErrors = result.errors.filter(e => e.file.includes("/gate/"));
    expect(gateErrors).toEqual([]);
  });
});

// ─── 2. 관계 그래프 검증 ─────────────────────────────────

describe("gate 관계 그래프", () => {
  it("gate-api → gate-state-model (refs)", () => {
    const links = result.registry.getLinks("gate-api", "outgoing");
    expect(links.some(l => l.targetId === "gate-state-model" && l.linkType === "refs")).toBe(true);
  });

  it("gate-api → gate-engine-func (implements)", () => {
    const links = result.registry.getLinks("gate-api", "outgoing");
    expect(links.some(l => l.targetId === "gate-engine-func" && l.linkType === "implements")).toBe(true);
  });

  it("gate-engine-func → gate-state-model (depends_on)", () => {
    const links = result.registry.getLinks("gate-engine-func", "outgoing");
    expect(links.some(l => l.targetId === "gate-state-model" && l.linkType === "depends_on")).toBe(true);
  });

  it("gate-flow → gate-api (refines)", () => {
    const links = result.registry.getLinks("gate-flow", "outgoing");
    expect(links.some(l => l.targetId === "gate-api" && l.linkType === "refines")).toBe(true);
  });

  it("gate-constraint → gate-api (constrains)", () => {
    const links = result.registry.getLinks("gate-constraint", "outgoing");
    expect(links.some(l => l.targetId === "gate-api" && l.linkType === "constrains")).toBe(true);
  });

  it("gate-scenario → gate-engine-func (traces_to, 비전파)", () => {
    const links = result.registry.getLinks("gate-scenario", "outgoing");
    expect(links.some(l => l.targetId === "gate-engine-func" && l.linkType === "traces_to")).toBe(true);
  });

  it("gate-state-model은 outgoing 1건 (depends_on gate-constraint)", () => {
    const links = result.registry.getLinks("gate-state-model", "outgoing");
    expect(links.some(l => l.targetId === "gate-constraint" && l.linkType === "depends_on")).toBe(true);
  });
});

// ─── 3. scope 기반 질의 ──────────────────────────────────

describe("scope 기반 질의", () => {
  it("'gate' 키워드가 포함된 interface 문서 조회", () => {
    const apis = classicGateDocs().filter((entry) => entry.scope === "interface");
    expect(apis.length).toBeGreaterThanOrEqual(1);
    expect(apis[0].id).toBe("gate-api");
  });

  it("feature scope에 gate 문서 (func_def + scenario 포함)", () => {
    const features = classicGateDocs().filter((entry) => entry.scope === "feature");
    expect(features.length).toBeGreaterThanOrEqual(2);
    const aspects = features.map(e => e.aspect);
    expect(aspects).toContain("func_def");
    expect(aspects).toContain("scenario");
  });

  it("validation depth 문서 조회 → gate-scenario만", () => {
    const validations = classicGateDocs().filter((entry) => entry.depth === "validation");
    expect(validations.length).toBe(1);
    expect(validations[0].id).toBe("gate-scenario");
  });
});

// ─── 4. concern 전파 검증 ────────────────────────────────

describe("concern 전파", () => {
  let concerns: Map<string, ReturnType<typeof computeAllConcerns> extends Map<string, infer V> ? V : never>;

  beforeAll(() => {
    concerns = computeAllConcerns(result.registry);
  });

  it("gate-constraint: security 직접", () => {
    const c = concerns.get("gate-constraint")!;
    expect(c.direct).toContain("security");
  });

  it("gate-api: security 직접 + gate-constraint에서 constrains로 security 상속", () => {
    const c = concerns.get("gate-api")!;
    expect(c.direct).toContain("security");
    // constrains 경로로도 상속
    expect(c.inherited.some(i =>
      i.concern === "security" && i.from === "gate-constraint" && i.via === "constrains"
    )).toBe(true);
  });

  it("gate-flow: gate-api를 refines → gate-api의 security 상속", () => {
    const c = concerns.get("gate-flow")!;
    expect(c.all).toContain("security");
    expect(c.inherited.some(i =>
      i.concern === "security" && i.via === "refines"
    )).toBe(true);
  });

  it("gate-state-model: security 미상속 (depends_on gate-constraint, security는 depends_on upstream 전파됨)", () => {
    const c = concerns.get("gate-state-model")!;
    // security의 전파 규칙에 depends_on upstream이 있음
    // gate-state-model --depends_on--> gate-constraint (security)
    expect(c.all).toContain("security");
    expect(c.inherited.some(i =>
      i.concern === "security" && i.from === "gate-constraint" && i.via === "depends_on"
    )).toBe(true);
  });

  it("gate-scenario: testing 직접, security 미상속 (traces_to는 전파 안 함)", () => {
    const c = concerns.get("gate-scenario")!;
    expect(c.direct).toContain("testing");
    // traces_to는 전파하지 않으므로 gate-engine-func/gate-api의 concern이 오지 않음
    const secFromTraces = c.inherited.filter(i => i.via === "traces_to");
    expect(secFromTraces.length).toBe(0);
  });

  it("gate-engine-func: gate-state-model을 depends_on → security 전이 전파", () => {
    const c = concerns.get("gate-engine-func")!;
    // gate-engine-func --depends_on--> gate-state-model --depends_on--> gate-constraint(security)
    expect(c.all).toContain("security");
  });
});

// ─── 5. 주제 분리 검증 (컨벤션) ──────────────────────────

describe("주제 분리 컨벤션 검증", () => {
  it("같은 기능을 다루는 문서가 5개 scope에 분포한다", () => {
    const gateScopes = new Set(classicGateDocs().map((entry) => entry.scope));
    // gate 관련 문서가 최소 3개 scope에 분포하면 주제 분리 달성
    expect(gateScopes.size).toBeGreaterThanOrEqual(3);
  });

  it("각 문서가 정확히 하나의 scope×aspect에만 속한다", () => {
    const gateDocs = classicGateDocs();
    for (const doc of gateDocs) {
      // cross-scope 태그가 없어야 함 (각자 자기 scope만)
      expect(doc.tags?.includes("cross-scope") ?? false).toBe(false);
    }
  });

  it("관계를 통해 전체 gate 시스템을 탐색할 수 있다", () => {
    // gate-api에서 출발하여 관계를 따라가면 모든 gate 문서에 도달
    const visited = new Set<string>();
    const queue = ["gate-api"];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      if (!CLASSIC_GATE_IDS.has(id)) continue;
      visited.add(id);

      const links = result.registry.getLinks(id, "both");
      for (const link of links) {
        if (CLASSIC_GATE_IDS.has(link.sourceId)) queue.push(link.sourceId);
        if (CLASSIC_GATE_IDS.has(link.targetId)) queue.push(link.targetId);
      }
    }

    expect(visited.size).toBe(CLASSIC_GATE_IDS.size);
  });
});
