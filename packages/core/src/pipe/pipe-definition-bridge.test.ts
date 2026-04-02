import { describe, it, expect } from "vitest";
import {
  resolveLifecycles, analyzeLayerPropagation, resolveTags, resolveBindings,
} from "./pipe-definition-bridge.js";
import type { DefinitionLookup, DefinitionMeta } from "./pipe-definition-bridge.js";
import type { PipeGraph, PipeSpec, PipeConnection } from "../types/pipe-spec.js";
import { BindingRegistry } from "../data-object/registry.js";
import type { DataObjectBinding } from "../data-object/types.js";
import { step } from "./__fixtures__/pipe-fixtures.js";

function makePipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return { pipeId: id, version: "1.0.0", trigger: { eventKey: `${id}_trigger` }, flow: step(), ...overrides };
}
function conn(from: string, to: string, kind: PipeConnection["kind"] = "next"): PipeConnection {
  return { from, to, kind };
}

// ── Mock lookup ──────────────────────────────────────

function mockLookup(docs: DefinitionMeta[]): DefinitionLookup {
  return {
    findByCoordinate(scope, aspect) {
      return docs.filter(d => d.docId.includes(scope) || d.docId.includes(aspect));
    },
    getById(docId) {
      return docs.find(d => d.docId === docId) ?? null;
    },
  };
}

// ── resolveLifecycles ────────────────────────────────

describe("resolveLifecycles", () => {
  it("scope×aspect로 lifecycle 조회", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [
        makePipe("A", { scope: "feature", aspect: "func_def" }),
        makePipe("B", { scope: "data", aspect: "domain_data" }),
      ],
      connections: [conn("A", "B")],
      entryPipeId: "A",
    };

    const lookup = mockLookup([
      { docId: "feature-spec", lifecycle: "approved", layer: "domain", tags: ["core"] },
      { docId: "data-spec", lifecycle: "draft", layer: "domain" },
    ]);

    const result = resolveLifecycles(graph, lookup);
    expect(result).toHaveLength(2);
    expect(result[0].lifecycle).toBe("approved");
    expect(result[1].lifecycle).toBe("draft");
  });

  it("scope/aspect 없는 파이프 → unknown", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A")],
      connections: [],
      entryPipeId: "A",
    };

    const result = resolveLifecycles(graph, mockLookup([]));
    expect(result[0].lifecycle).toBe("unknown");
  });
});

// ── analyzeLayerPropagation ──────────────────────────

describe("analyzeLayerPropagation", () => {
  it("domain → mediation 전파 감지", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [
        makePipe("A", { scope: "domain", aspect: "core" }),
        makePipe("B", { scope: "mediation", aspect: "api" }),
      ],
      connections: [conn("A", "B")],
      entryPipeId: "A",
    };

    const lookup = mockLookup([
      { docId: "domain-core", lifecycle: "approved", layer: "domain" },
      { docId: "mediation-api", lifecycle: "approved", layer: "mediation" },
    ]);

    const result = analyzeLayerPropagation(graph, lookup);
    expect(result).toHaveLength(1);
    expect(result[0].sourceLayer).toBe("domain");
    expect(result[0].affectedLayer).toBe("mediation");
  });
});

// ── resolveTags ──────────────────────────────────────

describe("resolveTags", () => {
  it("파이프별 tags 조회", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [
        makePipe("A", { scope: "feature", aspect: "func_def" }),
      ],
      connections: [],
      entryPipeId: "A",
    };

    const lookup = mockLookup([
      { docId: "feature-spec", lifecycle: "approved", tags: ["security", "performance"] },
    ]);

    const result = resolveTags(graph, lookup);
    expect(result[0].tags).toContain("security");
    expect(result[0].tags).toContain("performance");
  });

  it("scope 없으면 빈 tags", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A")],
      connections: [],
      entryPipeId: "A",
    };

    const result = resolveTags(graph, mockLookup([]));
    expect(result[0].tags).toHaveLength(0);
  });
});

// ── resolveBindings ──────────────────────────────────

describe("resolveBindings", () => {
  it("binding 있는 파이프와 없는 파이프를 함께 요약하고 warning을 남긴다", () => {
    const graph: PipeGraph = {
      graphId: "g-bindings",
      version: "1.0.0",
      pipes: [
        makePipe("A", {
          flow: step("저장", undefined, {
            dataContract: {
              accesses: [{ schemaId: "orders", columns: ["member_id"], mode: "write" }],
            },
          }),
        }),
        makePipe("B", {
          flow: step("저장", undefined, {
            dataContract: {
              accesses: [{ schemaId: "audit_log", columns: ["member_id"], mode: "write" }],
            },
          }),
        }),
      ],
      connections: [conn("A", "B")],
      entryPipeId: "A",
    };

    const registry = makeRegistry([
      makeBinding({
        schemaId: "orders",
        prefixId: "member_identity",
        columnToAxis: {
          member_id: { dimLabel: "memberId" },
        },
      }),
    ]);

    const result = resolveBindings(graph, registry);

    expect(result[0].bindings).toHaveLength(1);
    expect(result[0].warnings).toEqual([]);
    expect(result[1].bindings).toHaveLength(0);
    expect(result[1].missingSchemaIds).toEqual(["audit_log"]);
    expect(result[1].warnings).toEqual(['pipe "B"에 binding 없음']);
  });
});

function makeBinding(overrides: Partial<DataObjectBinding> = {}): DataObjectBinding {
  return {
    schemaId: "orders",
    schemaVersion: "v1",
    prefixId: "member_identity",
    prefixVersion: "v1",
    columnToAxis: {
      id: { dimLabel: "memberId" },
    },
    ...overrides,
  };
}

function makeRegistry(bindings: readonly DataObjectBinding[]): BindingRegistry {
  const registry = new BindingRegistry();

  for (const binding of bindings) {
    registry.register(binding);
  }

  return registry;
}
