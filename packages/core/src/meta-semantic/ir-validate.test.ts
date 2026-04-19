// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import type { DataIR, PipeIR } from "./ir-types.js";
import { computeSchemaHash } from "./ir-types.js";
import { validateIRGraph, type IRGraph } from "./ir-validate.js";
import { makeModule, makeData, makePipe } from "./__fixtures__/ir-fixtures.js";

describe("validateIRGraph", () => {
  // ── 정상 케이스 ─────────────────────────────────────

  it("유효한 그래프 → error 없음", () => {
    const root = makeModule("root", {
      relations: { parent: null, children: [{ moduleId: "child" }], internal: [], external: [] },
      interface: { inputs: [{ dataId: "Order", schemaHash: "a" }], outputs: [], sideEffects: [] },
    });
    const child = makeModule("child", {
      relations: { parent: { moduleId: "root" }, children: [], internal: [], external: [] },
    });
    const graph: IRGraph = { modules: [root, child], data: [makeData("Order", "root")], pipes: [makePipe("tx-1", "root", "Order")] };
    expect(validateIRGraph(graph).filter(i => i.severity === "error")).toHaveLength(0);
  });

  // ── 참조 무결성 ─────────────────────────────────────

  it("dangling parent ModuleRef → error", () => {
    const mod = makeModule("a", {
      relations: { parent: { moduleId: "nonexistent" }, children: [], internal: [], external: [] },
    });
    expect(validateIRGraph({ modules: [mod], data: [], pipes: [] }).some(i => i.type === "dangling-ref")).toBe(true);
  });

  it("dangling child ModuleRef → error", () => {
    const mod = makeModule("root", {
      relations: { parent: null, children: [{ moduleId: "ghost-child" }], internal: [], external: [] },
    });
    expect(validateIRGraph({ modules: [mod], data: [], pipes: [] }).some(i => i.type === "dangling-ref" && i.message.includes("ghost-child"))).toBe(true);
  });

  it("dangling input DataRef → error", () => {
    const mod = makeModule("svc", {
      interface: { inputs: [{ dataId: "MissingData", schemaHash: "" }], outputs: [], sideEffects: [] },
    });
    expect(validateIRGraph({ modules: [mod], data: [], pipes: [] }).some(i => i.type === "dangling-ref" && i.message.includes("MissingData"))).toBe(true);
  });

  it("dangling output DataRef → error", () => {
    const mod = makeModule("svc", {
      interface: { inputs: [], outputs: [{ dataId: "MissingOutput", schemaHash: "" }], sideEffects: [] },
    });
    expect(validateIRGraph({ modules: [mod], data: [], pipes: [] }).some(i => i.type === "dangling-ref" && i.message.includes("MissingOutput"))).toBe(true);
  });

  it("Pipe targetModule 미존재 → error", () => {
    const pipe = makePipe("tx-1", "ghost-svc", "SomeData");
    expect(validateIRGraph({ modules: [], data: [makeData("SomeData", "x")], pipes: [pipe] }).some(i => i.message.includes("ghost-svc"))).toBe(true);
  });

  it("Pipe payload 미존재 → error", () => {
    const mod = makeModule("svc");
    const pipe = makePipe("tx-1", "svc", "NonexistentPayload");
    expect(validateIRGraph({ modules: [mod], data: [], pipes: [pipe] }).some(i => i.message.includes("NonexistentPayload"))).toBe(true);
  });

  // ── 순환 탐지 ───────────────────────────────────────

  it("circular triggers → error", () => {
    const mod = makeModule("svc");
    const data = makeData("Req", "svc");
    const p1: PipeIR = { ...makePipe("tx-1", "svc", "Req"), triggers: [{ pipeId: "tx-2", targetModule: { moduleId: "svc" } }] };
    const p2: PipeIR = { ...makePipe("tx-2", "svc", "Req"), triggers: [{ pipeId: "tx-1", targetModule: { moduleId: "svc" } }] };
    expect(validateIRGraph({ modules: [mod], data: [data], pipes: [p1, p2] }).some(i => i.type === "circular-pipe")).toBe(true);
  });

  it("self-trigger → circular-pipe", () => {
    const mod = makeModule("svc");
    const data = makeData("Req", "svc");
    const p: PipeIR = { ...makePipe("tx-loop", "svc", "Req"), triggers: [{ pipeId: "tx-loop", targetModule: { moduleId: "svc" } }] };
    expect(validateIRGraph({ modules: [mod], data: [data], pipes: [p] }).some(i => i.type === "circular-pipe")).toBe(true);
  });

  it("circular parent (A→B→A) → error", () => {
    const a = makeModule("a", { relations: { parent: { moduleId: "b" }, children: [], internal: [], external: [] } });
    const b = makeModule("b", { relations: { parent: { moduleId: "a" }, children: [], internal: [], external: [] } });
    expect(validateIRGraph({ modules: [a, b], data: [], pipes: [] }).some(i => i.type === "circular-parent")).toBe(true);
  });

  it("deep parent chain (10-level) — no cycle → no circular-parent", () => {
    const modules = Array.from({ length: 10 }, (_, i) => makeModule(`m${i}`, {
      relations: { parent: i > 0 ? { moduleId: `m${i - 1}` } : null, children: i < 9 ? [{ moduleId: `m${i + 1}` }] : [], internal: [], external: [] },
    }));
    const issues = validateIRGraph({ modules, data: [], pipes: [] });
    expect(issues.filter(i => i.type === "circular-parent")).toHaveLength(0);
  });

  // ── 고아/중복 ───────────────────────────────────────

  it("missing-manager → error", () => {
    expect(validateIRGraph({ modules: [], data: [makeData("Order", "ghost")], pipes: [] }).some(i => i.type === "missing-manager")).toBe(true);
  });

  it("orphan-data (producedBy/consumedBy 비어있음) → warning", () => {
    const data: DataIR = { ...makeData("Orphan", "svc"), lifecycle: { producedBy: [], consumedBy: [], transformedBy: [] } };
    expect(validateIRGraph({ modules: [makeModule("svc")], data: [data], pipes: [] }).some(i => i.type === "orphan-data")).toBe(true);
  });

  it("orphan-module (비루트 leaf, 아무도 참조 안 함) → warning", () => {
    const root = makeModule("root", { relations: { parent: null, children: [{ moduleId: "child" }], internal: [], external: [] } });
    const child = makeModule("child", { relations: { parent: { moduleId: "root" }, children: [], internal: [], external: [] } });
    const orphan = makeModule("orphan"); // parent=null, children=[], 아무도 참조 안 함
    expect(validateIRGraph({ modules: [root, child, orphan], data: [], pipes: [] }).some(i => i.type === "orphan-module" && i.target === "orphan")).toBe(true);
  });

  it("schema-collision (같은 hash, 다른 type) → warning", () => {
    const svc = makeModule("svc");
    const fields = [{ name: "id", type: "string", optional: false, hasDefault: false }];
    const hash = computeSchemaHash(fields);
    const d1: DataIR = { ...makeData("TypeA", "svc"), definition: { type: "TypeA", schemaHash: hash, fields, certainty: "strict" } };
    const d2: DataIR = { ...makeData("TypeB", "svc"), definition: { type: "TypeB", schemaHash: hash, fields, certainty: "strict" } };
    expect(validateIRGraph({ modules: [svc], data: [d1, d2], pipes: [] }).some(i => i.type === "schema-collision")).toBe(true);
  });
});
