import { describe, it, expect } from "vitest";
import type { ModuleIR, DataIR } from "./ir-types.js";
import { computeSchemaHash } from "./ir-types.js";
import { auditIRGraph } from "./ir-audit.js";
import type { IRGraph } from "./ir-validate.js";
import { makeModule, makeData } from "./__fixtures__/ir-fixtures.js";

describe("auditIRGraph", () => {

  // ── 정합성 (consistency) ─────────────────────────────

  describe("consistency", () => {
    it("정합적인 그래프 → consistency 이슈 없음", () => {
      const root = makeModule("root", {
        relations: { parent: null, children: [{ moduleId: "child" }], internal: [], external: [] },
        meta: { level: "group" },
      });
      const child = makeModule("child", {
        relations: { parent: { moduleId: "root" }, children: [], internal: [], external: [] },
        meta: { level: "leaf" },
      });
      const graph: IRGraph = { modules: [root, child], data: [makeData("D", "root")], pipes: [] };
      const issues = auditIRGraph(graph).filter(i => i.category === "consistency");
      expect(issues).toHaveLength(0);
    });

    it("level 불일치 → level-mismatch error", () => {
      const mod = makeModule("wrong-level", {
        relations: { parent: null, children: [{ moduleId: "c" }], internal: [], external: [] },
        meta: { level: "leaf" }, // group이어야 함
      });
      const issues = auditIRGraph({ modules: [mod, makeModule("c", { relations: { parent: { moduleId: "wrong-level" }, children: [], internal: [], external: [] } })], data: [], pipes: [] });
      expect(issues.some(i => i.rule === "level-mismatch" && i.target === "wrong-level")).toBe(true);
    });

    it("certainty 불일치 → certainty-mismatch error", () => {
      const fields = [{ name: "x", type: "any", optional: false, hasDefault: false }];
      const d: DataIR = {
        ...makeData("Bad", "svc"),
        definition: { type: "Bad", schemaHash: computeSchemaHash(fields), fields, certainty: "strict" },
      };
      const issues = auditIRGraph({ modules: [makeModule("svc")], data: [d], pipes: [] });
      expect(issues.some(i => i.rule === "certainty-mismatch")).toBe(true);
    });

    it("schemaHash 불일치 → hash-mismatch error", () => {
      const fields = [{ name: "id", type: "string", optional: false, hasDefault: false }];
      const d: DataIR = {
        ...makeData("WrongHash", "svc"),
        definition: { type: "WrongHash", schemaHash: "deadbeef", fields, certainty: "strict" },
      };
      const issues = auditIRGraph({ modules: [makeModule("svc")], data: [d], pipes: [] });
      expect(issues.some(i => i.rule === "hash-mismatch")).toBe(true);
    });

    it("비표준 uidScheme → nonstandard-uid-scheme warning", () => {
      const d: DataIR = {
        ...makeData("Custom", "svc"),
        storage: { uid: "custom:v1:0:0:0", uidScheme: "custom:v1", storageType: "db", retention: "persistent" },
      };
      const issues = auditIRGraph({ modules: [makeModule("svc")], data: [d], pipes: [] });
      expect(issues.some(i => i.rule === "nonstandard-uid-scheme")).toBe(true);
    });
  });

  // ── 분할 신호 (split-signal) ─────────────────────────

  describe("split-signal", () => {
    it("inputs > 5 → too-many-inputs", () => {
      const mod = makeModule("fat", {
        interface: {
          inputs: Array.from({ length: 6 }, (_, i) => ({ dataId: `D${i}`, schemaHash: "" })),
          outputs: [], sideEffects: [],
        },
      });
      const issues = auditIRGraph({ modules: [mod], data: [], pipes: [] });
      expect(issues.some(i => i.rule === "too-many-inputs")).toBe(true);
    });

    it("outputs > 3 → too-many-outputs", () => {
      const mod = makeModule("producer", {
        interface: {
          inputs: [],
          outputs: Array.from({ length: 4 }, (_, i) => ({ dataId: `O${i}`, schemaHash: "" })),
          sideEffects: [],
        },
      });
      const issues = auditIRGraph({ modules: [mod], data: [], pipes: [] });
      expect(issues.some(i => i.rule === "too-many-outputs")).toBe(true);
    });

    it("children > 7 → too-many-children", () => {
      const children = Array.from({ length: 8 }, (_, i) => ({ moduleId: `c${i}` }));
      const mod = makeModule("wide", {
        relations: { parent: null, children, internal: [], external: [] },
        meta: { level: "group" },
      });
      const childModules = children.map(c => makeModule(c.moduleId, {
        relations: { parent: { moduleId: "wide" }, children: [], internal: [], external: [] },
      }));
      const issues = auditIRGraph({ modules: [mod, ...childModules], data: [], pipes: [] });
      expect(issues.some(i => i.rule === "too-many-children")).toBe(true);
    });

    it("certainty 혼재 → mixed-certainty warning", () => {
      const svc = makeModule("svc");
      const strictFields = [{ name: "id", type: "string", optional: false, hasDefault: false }];
      const flexFields = [{ name: "data", type: "any", optional: false, hasDefault: false }];
      const d1: DataIR = {
        ...makeData("Strict", "svc"),
        definition: { type: "Strict", schemaHash: computeSchemaHash(strictFields), fields: strictFields, certainty: "strict" },
      };
      const d2: DataIR = {
        ...makeData("Flex", "svc"),
        definition: { type: "Flex", schemaHash: computeSchemaHash(flexFields), fields: flexFields, certainty: "flexible" },
      };
      const issues = auditIRGraph({ modules: [svc], data: [d1, d2], pipes: [] });
      expect(issues.some(i => i.rule === "mixed-certainty")).toBe(true);
    });

    it("공유 데이터 3+ → shared-data info", () => {
      const modules = ["a", "b", "c"].map(id => makeModule(id));
      const d: DataIR = {
        ...makeData("Shared", "a"),
        lifecycle: {
          producedBy: [{ moduleId: "a" }],
          consumedBy: [{ moduleId: "b" }, { moduleId: "c" }],
          transformedBy: [],
        },
      };
      const issues = auditIRGraph({ modules, data: [d], pipes: [] });
      expect(issues.some(i => i.rule === "shared-data")).toBe(true);
    });

    it("임계치 이하면 분할 신호 없음", () => {
      const mod = makeModule("small", {
        interface: {
          inputs: [{ dataId: "D1", schemaHash: "" }],
          outputs: [{ dataId: "O1", schemaHash: "" }],
          sideEffects: [],
        },
        relations: { parent: null, children: [{ moduleId: "c1" }], internal: [], external: [] },
        meta: { level: "group" },
      });
      const child = makeModule("c1", {
        relations: { parent: { moduleId: "small" }, children: [], internal: [], external: [] },
      });
      const issues = auditIRGraph({ modules: [mod, child], data: [makeData("D1", "small")], pipes: [] });
      expect(issues.filter(i => i.category === "split-signal")).toHaveLength(0);
    });
  });
});
