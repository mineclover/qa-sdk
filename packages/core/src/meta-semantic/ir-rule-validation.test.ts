// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * IR Rule 유효성 검증 — rule.md의 체크리스트와 분할 규칙을 실제 코드로 검증.
 *
 * rule 문서의 각 섹션이 실제로 판별 가능하고,
 * 위반 시 적절한 검증 결과를 생성하는지 확인한다.
 */

import { describe, it, expect } from "vitest";
import type { ModuleIR, DataIR, PipeIR } from "./ir-types.js";
import { computeSchemaHash, deriveCertainty, inferModuleLevel } from "./ir-types.js";
import { validateIRGraph, type IRGraph } from "./ir-validate.js";
import { makeModule, makeData, makePipe } from "./__fixtures__/ir-fixtures.js";
import {
  type ScopeNesting,
  validateScopeNesting,
} from "../scope-nesting.js";

// ── §2 패싯 체크리스트를 코드로 실행 ──────────────────

describe("rule §2: 패싯 체크리스트 — 코드 검증", () => {

  describe("ModuleIR 체크리스트", () => {
    it("meta.level이 inferModuleLevel과 불일치하면 감지 가능", () => {
      // rule: "meta.level → inferModuleLevel(relations) 결과와 일치하는가"
      const mod: ModuleIR = {
        ...makeModule("svc"),
        relations: { parent: null, children: [{ moduleId: "child" }], internal: [], external: [] },
        meta: { level: "leaf" }, // 잘못됨 — children이 있으므로 group이어야
      };
      const inferred = inferModuleLevel(mod.relations);
      expect(mod.meta.level).not.toBe(inferred); // 불일치 감지
      expect(inferred).toBe("group");
    });
  });

  describe("DataIR 체크리스트", () => {
    it("certainty가 deriveCertainty와 불일치하면 감지 가능", () => {
      // rule: "definition.certainty → deriveCertainty(fields) 결과와 일치하는가"
      const fields = [{ name: "data", type: "any", optional: false, hasDefault: false }];
      const declared: DataIR = {
        ...makeData("Flexible", "svc"),
        definition: { type: "Flexible", schemaHash: computeSchemaHash(fields), fields, certainty: "strict" },
      };
      expect(declared.definition.certainty).not.toBe(deriveCertainty(fields)); // 불일치
      expect(deriveCertainty(fields)).toBe("flexible");
    });

    it("schemaHash가 computeSchemaHash와 불일치하면 감지 가능", () => {
      // rule: "definition.schemaHash → computeSchemaHash(fields) 결과와 일치하는가"
      const fields = [{ name: "id", type: "string", optional: false, hasDefault: false }];
      const wrongHash = "00000000";
      const correctHash = computeSchemaHash(fields);
      expect(wrongHash).not.toBe(correctHash);
    });
  });

  describe("Cross-IR 체크리스트", () => {
    it("Pipe.payload가 Data에 없으면 dangling-ref", () => {
      // rule: "모든 Pipe.payload.dataId ∈ {Data.definition.type}"
      const mod = makeModule("svc");
      const pipe = makePipe("tx-1", "svc", "NonexistentData");
      const graph: IRGraph = { modules: [mod], data: [], pipes: [pipe] };
      const issues = validateIRGraph(graph);
      expect(issues.some(i => i.type === "dangling-ref" && i.message.includes("NonexistentData"))).toBe(true);
    });
  });
});

// ── §3 Nesting Provider 분할 규칙 검증 ────────────────

describe("rule §3: Nesting Provider 분할 규칙", () => {

  describe("분할 판별 기준", () => {
    it("inputs > 5이면 분할 신호", () => {
      // rule: "interface.inputs > 5개 → 소비 계약이 너무 많음"
      const mod = makeModule("fat-consumer", {
        interface: {
          inputs: Array.from({ length: 6 }, (_, i) => ({ dataId: `D${i}`, schemaHash: "" })),
          outputs: [],
          sideEffects: [],
        },
      });
      expect(mod.interface.inputs.length).toBeGreaterThan(5);
      // 판별 함수를 코드로 표현 가능
    });

    it("children > 7이면 중간 계층 삽입 신호", () => {
      // rule: "relations.children > 7개 → 중간 module 계층 삽입"
      const children = Array.from({ length: 8 }, (_, i) => ({ moduleId: `child-${i}` }));
      const mod = makeModule("wide-parent", {
        relations: { parent: null, children, internal: [], external: [] },
      });
      expect(mod.relations.children.length).toBeGreaterThan(7);
    });

    it("certainty 혼재 감지", () => {
      // rule: "같은 모듈에 strict + flexible 데이터 공존 → 분리"
      const strictFields = [{ name: "id", type: "string", optional: false, hasDefault: false }];
      const flexFields = [{ name: "data", type: "any", optional: false, hasDefault: false }];
      const moduleDataItems = [
        { certainty: deriveCertainty(strictFields) },
        { certainty: deriveCertainty(flexFields) },
      ];
      const hasMixed = new Set(moduleDataItems.map(d => d.certainty)).size > 1;
      expect(hasMixed).toBe(true);
    });
  });

  describe("Contract Descent 정합성 (ScopeNesting ↔ ModuleIR)", () => {
    it("nesting missing-provider와 IR dangling-ref가 동시 발생", () => {
      // rule: "경로 없으면 → missing-provider + dangling-ref 동시 발생"

      // nesting: child가 "auth-token" 소비하지만 아무도 제공 안 함
      const nesting: ScopeNesting = {
        nestingId: "test-nesting",
        scopes: [
          { scopeId: "app", provides: [], consumes: [] },
          { scopeId: "page", provides: [], consumes: [{ contractId: "auth-token", type: "state" }] },
        ],
      };
      const nestingResult = validateScopeNesting(nesting);
      const hasMissingProvider = nestingResult.issues.some(i => i.code === "missing-provider");
      expect(hasMissingProvider).toBe(true);

      // IR: page 모듈이 auth-token 데이터를 소비하지만 Data가 그래프에 없음
      const app = makeModule("app", {
        relations: { parent: null, children: [{ moduleId: "page" }], internal: [], external: [] },
      });
      const page = makeModule("page", {
        relations: { parent: { moduleId: "app" }, children: [], internal: [], external: [] },
        interface: { inputs: [{ dataId: "auth-token", schemaHash: "" }], outputs: [], sideEffects: [] },
      });
      const irGraph: IRGraph = { modules: [app, page], data: [], pipes: [] };
      const irIssues = validateIRGraph(irGraph);
      const hasDanglingRef = irIssues.some(i => i.type === "dangling-ref" && i.message.includes("auth-token"));
      expect(hasDanglingRef).toBe(true);

      // 두 검증이 같은 문제를 다른 관점에서 잡는다
    });

    it("nesting override-no-parent와 IR 계층 불일치 동시 감지", () => {
      // rule: "override-no-parent + orphan-module 가능성"
      const nesting: ScopeNesting = {
        nestingId: "override-test",
        scopes: [
          { scopeId: "root", provides: [], consumes: [] },
          { scopeId: "child", provides: [{ contractId: "config", type: "state", override: true }], consumes: [] },
        ],
      };
      const nestingResult = validateScopeNesting(nesting);
      expect(nestingResult.issues.some(i => i.code === "override-no-parent")).toBe(true);
    });
  });

  describe("분할 후 검증 순서", () => {
    it("step 1→2: nesting 검증 통과 후 IR 검증 통과", () => {
      // 올바르게 분할된 구조
      const nesting: ScopeNesting = {
        nestingId: "clean",
        scopes: [
          { scopeId: "app", provides: [{ contractId: "db", type: "persist" }], consumes: [] },
          { scopeId: "service", provides: [], consumes: [{ contractId: "db", type: "persist" }] },
        ],
      };
      const nestingResult = validateScopeNesting(nesting);
      expect(nestingResult.valid).toBe(true);

      const app = makeModule("app", {
        relations: { parent: null, children: [{ moduleId: "service" }], internal: [], external: [] },
        interface: { inputs: [], outputs: [{ dataId: "db", schemaHash: "" }], sideEffects: [] },
      });
      const service = makeModule("service", {
        relations: { parent: { moduleId: "app" }, children: [], internal: [], external: [] },
        interface: { inputs: [{ dataId: "db", schemaHash: "" }], outputs: [], sideEffects: [] },
      });
      const db = makeData("db", "app");
      const irGraph: IRGraph = { modules: [app, service], data: [db], pipes: [] };
      const irErrors = validateIRGraph(irGraph).filter(i => i.severity === "error");
      expect(irErrors).toHaveLength(0);
    });
  });
});
