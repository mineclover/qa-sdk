// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from "vitest";

import {
  normalizeDocumentEnvelope,
  normalizeDocumentGraphEdges,
  TRAVERSAL_AXIS_PRIORITY,
  type DocumentEnvelope,
  type DocumentEnvelopeInput,
} from "./index.js";

describe("docs-control-plane graph edge normalization", () => {
  it("maps existing envelope relationships into canonical traversal axes", () => {
    const edges = normalizeDocumentGraphEdges(fixtureDocuments());

    expect(edge(edges, "contains")).toMatchObject({
      axis: "composition",
      fromNodeId: "document:checkout-spec",
      toNodeId: "document:checkout-child",
    });
    expect(edge(edges, "refines")).toMatchObject({
      axis: "refinement",
      toNodeId: "document:checkout-base",
    });
    expect(edge(edges, "depends_on")).toMatchObject({
      axis: "dependency",
      toNodeId: "document:checkout-plan",
    });
    expect(edge(edges, "constrains")).toMatchObject({
      axis: "constraint",
      toNodeId: "document:checkout-rule-target",
    });

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "document-constraint",
          axis: "constraint",
          fromNodeId: "document:checkout-rule",
          toNodeId: "document:checkout-spec",
          authoredType: "rule-family",
        }),
      ]),
    );

    expect(edge(edges, "traces_to")).toMatchObject({
      axis: "trace",
      toNodeId: "document:tasks/checkout-prd",
    });
    expect(edge(edges, "task")).toMatchObject({
      kind: "task-trace",
      axis: "trace",
      fromNodeId: "document:tasks/checkout-prd",
      toNodeId: "task:tasks/checkout-prd:US-000",
    });
    expect(edge(edges, "task-dependency")).toMatchObject({
      kind: "task-trace",
      axis: "trace",
      fromNodeId: "task:tasks/checkout-prd:US-001",
      toNodeId: "task:tasks/checkout-prd:US-000",
    });
    expect(edge(edges, "ralph-session-prd")).toMatchObject({
      kind: "task-trace",
      axis: "trace",
      fromNodeId: "document:ralph-session:session-1",
      toNodeId: "document:tasks/checkout-prd",
    });

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "document-source",
          axis: "source",
          fromNodeId: "document:checkout-spec",
          toNodeId: "source:packages/checkout/src/index.ts",
        }),
        expect.objectContaining({
          kind: "document-source",
          axis: "source",
          fromNodeId: "document:checkout-evidence",
          toNodeId: "source:packages/cli/src/commands/docs.test.ts",
        }),
      ]),
    );

    expect(edge(edges, "verifies")).toMatchObject({
      kind: "document-evidence",
      axis: "evidence",
      fromNodeId: "document:checkout-evidence",
      toNodeId: "document:checkout-spec",
    });
    expect(edge(edges, "materializes_output")).toMatchObject({
      kind: "document-evidence",
      axis: "evidence",
      toNodeId: "document:checkout-evidence",
    });
    expect(edge(edges, "verificationRefs", "evidence")).toMatchObject({
      kind: "document-evidence",
      axis: "evidence",
      toNodeId: "source:packages/cli/src/commands/docs.test.ts",
    });
    expect(edge(edges, "activation-evidence")).toMatchObject({
      kind: "document-evidence",
      axis: "evidence",
      fromNodeId: "document:checkout-evidence",
    });

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "role-membership",
          axis: "role",
          fromNodeId: "document:checkout-spec",
          toNodeId: "document:checkout-todo",
        }),
        expect.objectContaining({
          kind: "role-membership",
          axis: "role",
          fromNodeId: "document:tasks/checkout-prd",
          toNodeId: "document:ralph-session:session-1",
        }),
      ]),
    );

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "context-metadata",
          axis: "context",
          toNodeId: "context:tag:checkout",
        }),
        expect.objectContaining({
          kind: "context-metadata",
          axis: "context",
          toNodeId: "context:knowledgeKind:guide",
        }),
      ]),
    );
    expect(edges.at(-1)?.axis).toBe("context");
    expect(TRAVERSAL_AXIS_PRIORITY.context).toBeGreaterThan(TRAVERSAL_AXIS_PRIORITY.role);
  });

  it("can omit context edges for strict traversal presets", () => {
    const edges = normalizeDocumentGraphEdges(fixtureDocuments(), {
      includeContext: false,
    });

    expect(edges.map((item) => item.axis)).not.toContain("context");
  });

  it("preserves explainability metadata on every normalized edge reason", () => {
    const edges = normalizeDocumentGraphEdges(fixtureDocuments());

    for (const normalizedEdge of edges) {
      expect(normalizedEdge.reasons.length).toBeGreaterThan(0);
      for (const reason of normalizedEdge.reasons) {
        expect(reason.adapterId).toEqual(expect.any(String));
        expect(reason.reason).toEqual(expect.any(String));
        expect(reason.rawSource).toEqual(expect.objectContaining({
          path: expect.any(String),
        }));
        expect(reason.sourceDocumentId).toEqual(expect.any(String));
        expect(reason.sourceDocumentPath).toEqual(expect.any(String));
        expect(reason.targetNodeId).toBe(normalizedEdge.toNodeId);
        expect(reason.targetNodePath).toEqual(expect.any(String));
      }
    }
  });
});

function edge(
  edges: readonly ReturnType<typeof normalizeDocumentGraphEdges>[number][],
  authoredType: string,
  axis?: ReturnType<typeof normalizeDocumentGraphEdges>[number]["axis"],
): ReturnType<typeof normalizeDocumentGraphEdges>[number] {
  const match = edges.find((item) =>
    item.authoredType === authoredType && (!axis || item.axis === axis)
  );
  expect(match).toBeDefined();
  return match!;
}

function fixtureDocuments(): readonly DocumentEnvelope[] {
  return [
    envelope({
      adapterId: "definition-markdown",
      kind: "spec",
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
      metadata: {
        defId: "checkout-spec",
        sourcePath: "docs/specs/checkout/checkout.spec.md",
        tags: ["checkout"],
        scope: "flow",
        aspect: "process_flow",
        layer: "mediation",
      },
      links: [
        { targetId: "checkout-child", type: "contains", metadata: {} },
        { targetId: "checkout-base", type: "refines", metadata: {} },
        { targetId: "checkout-plan", type: "depends_on", metadata: {} },
        { targetId: "checkout-rule-target", type: "constrains", metadata: {} },
        { targetId: "tasks/checkout-prd", type: "traces_to", metadata: {} },
      ],
      sources: [
        {
          id: "source:1",
          path: "packages/checkout/src/index.ts",
          label: "Checkout",
          rawSource: { path: "docs/specs/checkout/checkout.spec.md", pointer: "frontmatter.source" },
        },
      ],
    }),
    definitionDoc("checkout-child", "spec", "checkout-child.spec.md"),
    definitionDoc("checkout-base", "spec", "checkout-base.spec.md"),
    definitionDoc("checkout-plan", "plan", "checkout.plan.md"),
    definitionDoc("checkout-todo", "todo", "checkout.todo.md"),
    definitionDoc("checkout-rule-target", "spec", "checkout-rule-target.spec.md"),
    envelope({
      adapterId: "definition-markdown",
      kind: "rule",
      stableId: "checkout-rule",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.rule.md",
      metadata: {
        defId: "checkout-rule",
        sourcePath: "docs/specs/checkout/checkout.rule.md",
      },
    }),
    envelope({
      adapterId: "definition-markdown",
      kind: "spec",
      stableId: "checkout-knowledge",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout-knowledge.spec.md",
      metadata: {
        defId: "checkout-knowledge",
        type: "knowledge",
        knowledgeKind: "guide",
        sourcePath: "docs/specs/checkout/checkout-knowledge.spec.md",
      },
    }),
    envelope({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/checkout-prd",
      familyId: "tasks/checkout-prd",
      path: "tasks/checkout-prd.md",
      metadata: {
        title: "Checkout PRD",
        sourcePath: "tasks/checkout-prd.md",
      },
      tasks: [
        {
          id: "US-000",
          title: "Prepare checkout",
          metadata: { prerequisites: [] },
        },
        {
          id: "US-001",
          title: "Complete checkout",
          metadata: { prerequisites: ["US-000"] },
        },
      ],
    }),
    envelope({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/checkout-prd",
      familyId: "tasks/checkout-prd",
      path: "tasks/checkout-prd.json",
      metadata: {
        sourcePath: "tasks/checkout-prd.json",
      },
      tasks: [
        {
          id: "US-000",
          title: "Prepare checkout",
          metadata: { dependsOn: [] },
        },
        {
          id: "US-001",
          title: "Complete checkout",
          metadata: { dependsOn: ["US-000"] },
        },
      ],
    }),
    envelope({
      adapterId: "ralph-session",
      kind: "ralph-session",
      stableId: "ralph-session:session-1",
      familyId: "tasks/checkout-prd",
      path: ".ralph-tui/session-meta.json",
      metadata: {
        id: "session-1",
        sourcePath: ".ralph-tui/session-meta.json",
        prdPath: "tasks/checkout-prd.json",
      },
    }),
    envelope({
      adapterId: "artifact-evidence",
      kind: "activation-evidence",
      stableId: "checkout-evidence",
      familyId: "checkout-spec",
      path: "artifacts/checkout-evidence.json",
      metadata: {
        artifactId: "checkout-evidence",
        artifactRef: "artifacts/checkout-evidence.json",
        outputPath: "artifacts/checkout-evidence.json",
        verifiesRefs: ["checkout-spec"],
        materializesOutputRefs: ["artifacts/checkout-evidence.json"],
        verificationRefs: ["packages/cli/src/commands/docs.test.ts"],
        sourceRefs: ["docs/specs/checkout/checkout.spec.md"],
        packId: "checkout-pack",
      },
      links: [
        { targetId: "checkout-spec", type: "verifies", metadata: {} },
        { targetId: "artifacts/checkout-evidence.json", type: "materializes_output", metadata: {} },
      ],
      sources: [
        {
          id: "verification-ref:1",
          path: "packages/cli/src/commands/docs.test.ts",
          rawSource: { path: "artifacts/programming-artifacts.json", pointer: "/artifacts/0" },
          metadata: { sourceKind: "verification_ref" },
        },
      ],
      evidence: [
        {
          id: "checkout-evidence",
          kind: "activation-evidence",
          rawSource: { path: "artifacts/programming-artifacts.json", pointer: "/artifacts/0" },
        },
      ],
    }),
  ];
}

function definitionDoc(
  stableId: string,
  kind: string,
  fileName: string,
): DocumentEnvelope {
  return envelope({
    adapterId: "definition-markdown",
    kind,
    stableId,
    familyId: kind === "plan" || kind === "todo"
      ? "docs/specs/checkout/checkout"
      : `docs/specs/checkout/${stableId}`,
    path: `docs/specs/checkout/${fileName}`,
    metadata: {
      defId: stableId,
      sourcePath: `docs/specs/checkout/${fileName}`,
    },
  });
}

function envelope(
  input: Omit<DocumentEnvelopeInput, "rawSource"> & {
    readonly rawSource?: DocumentEnvelopeInput["rawSource"];
  },
): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    links: [],
    sources: [],
    sections: [],
    tasks: [],
    evidence: [],
    diagnostics: [],
    ...input,
    rawSource: input.rawSource ?? {
      path: input.path,
      sourceSchema: input.adapterId,
    },
  });
}
