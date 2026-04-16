import { describe, expect, it } from "vitest";

import {
  buildDocumentGraphIndex,
  normalizeDocumentEnvelope,
  type DocumentEnvelope,
  type DocumentEnvelopeInput,
} from "./index.js";

describe("docs-control-plane graph index", () => {
  it("materializes deduplicated graph nodes with stable lookup indexes", () => {
    const index = buildDocumentGraphIndex(fixtureDocuments(), {
      rootDir: "/repo",
    });

    expect(index.nodesById.get("document:checkout-spec")).toMatchObject({
      kind: "spec",
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
    });
    expect(index.nodesById.get("document:tasks/checkout-prd")).toMatchObject({
      kind: "prd",
      stableId: "tasks/checkout-prd",
      familyId: "tasks/checkout-prd",
    });
    expect(index.nodesById.get("document:tasks/checkout-prd")?.reasons).toHaveLength(2);
    expect(index.nodesById.get("task:tasks/checkout-prd:US-003")).toMatchObject({
      kind: "task",
      metadata: expect.objectContaining({
        taskId: "US-003",
      }),
    });
    expect(index.nodesById.get("task:tasks/checkout-prd:US-003")?.reasons).toHaveLength(2);
    expect(index.nodesById.get("source:packages/checkout/src/index.ts")).toMatchObject({
      kind: "source",
      path: "packages/checkout/src/index.ts",
    });
    expect(index.nodesById.get("evidence:checkout-evidence")).toMatchObject({
      kind: "evidence",
      stableId: "checkout-evidence",
    });
    expect(index.nodesById.get("section:checkout-spec:purpose")).toMatchObject({
      kind: "section",
      path: "docs/specs/checkout/checkout.spec.md#^purpose",
    });

    expect(nodeIds(index.lookup.byStableId.get("checkout-spec"))).toContain("document:checkout-spec");
    expect(nodeIds(index.lookup.byFamilyId.get("docs/specs/checkout"))).toEqual(
      expect.arrayContaining([
        "document:checkout-rule",
        "document:checkout-spec",
        "section:checkout-spec:purpose",
      ]),
    );
    expect(nodeIds(index.lookup.byPath.get("docs/specs/checkout/checkout.spec.md"))).toContain(
      "document:checkout-spec",
    );
    expect(nodeIds(index.lookup.bySourcePath.get("packages/checkout/src/index.ts"))).toContain(
      "source:packages/checkout/src/index.ts",
    );
    expect(nodeIds(index.lookup.byTaskId.get("US-003"))).toContain(
      "task:tasks/checkout-prd:US-003",
    );
    expect(nodeIds(index.lookup.byArtifactId.get("checkout-evidence"))).toContain(
      "document:checkout-evidence",
    );
    expect(nodeIds(index.lookup.byEvidenceRef.get("checkout-evidence"))).toEqual(
      expect.arrayContaining([
        "document:checkout-evidence",
        "evidence:checkout-evidence",
        "task:tasks/checkout-prd:US-003",
      ]),
    );
  });

  it("dedupes equivalent edges while preserving all supporting reasons", () => {
    const index = buildDocumentGraphIndex(fixtureDocuments(), {
      rootDir: "/repo",
    });

    const containsEdge = index.edges.find((edge) =>
      edge.authoredType === "contains" &&
      edge.fromNodeId === "document:checkout-spec" &&
      edge.toNodeId === "document:checkout-child"
    );
    expect(containsEdge).toMatchObject({
      axis: "composition",
      kind: "authored-link",
    });
    expect(containsEdge?.reasons).toHaveLength(2);

    const taskEdge = index.edges.find((edge) =>
      edge.authoredType === "task" &&
      edge.fromNodeId === "document:tasks/checkout-prd" &&
      edge.toNodeId === "task:tasks/checkout-prd:US-003"
    );
    expect(taskEdge).toMatchObject({
      axis: "trace",
      kind: "task-trace",
    });
    expect(taskEdge?.reasons).toHaveLength(2);

    expect(index.outgoing("document:checkout-spec").map((edge) => edge.toNodeId)).toEqual(
      expect.arrayContaining([
        "document:checkout-child",
        "section:checkout-spec:purpose",
        "source:packages/checkout/src/index.ts",
      ]),
    );
    expect(index.incoming("document:checkout-spec").map((edge) => edge.fromNodeId)).toEqual(
      expect.arrayContaining([
        "document:checkout-child",
        "document:checkout-rule",
        "document:checkout-evidence",
      ]),
    );
    expect(index.outgoingEdgesByNodeId.get("document:checkout-spec")).toEqual(
      index.outgoing("document:checkout-spec"),
    );
    expect(index.incomingEdgesByNodeId.get("document:checkout-spec")).toEqual(
      index.incoming("document:checkout-spec"),
    );
  });

  it("resolves source-path targets without broad repository fallback", () => {
    const index = buildDocumentGraphIndex(fixtureDocuments(), {
      rootDir: "/repo",
    });

    const resolved = index.resolveTarget("/repo/packages/checkout/src/index.ts");
    expect(resolved).toMatchObject({
      lookupKind: "source-path",
      indexed: true,
      node: {
        id: "source:packages/checkout/src/index.ts",
        kind: "source",
      },
    });
    expect(resolved.nodes.map((node) => node.kind)).toEqual(["source"]);
    expect(index.incoming(resolved.node!.id).map((edge) => edge.fromNodeId)).toEqual(
      expect.arrayContaining([
        "document:checkout-spec",
        "document:checkout-evidence",
      ]),
    );

    const missing = index.resolveTarget("/repo/packages/missing/src/nope.ts");
    expect(missing).toMatchObject({
      lookupKind: "source-path-missing",
      indexed: false,
      node: {
        id: "source:packages/missing/src/nope.ts",
        kind: "source",
        metadata: expect.objectContaining({
          sourceMapCoverage: "missing",
        }),
      },
    });
    expect(missing.nodes).toHaveLength(1);
    expect(missing.nodes.map((node) => node.id)).not.toContain("document:checkout-spec");
    expect(missing.diagnostics).toEqual([
      expect.objectContaining({
        code: "source-map-missing",
      }),
    ]);
    expect(index.outgoing(missing.node!.id)).toEqual([]);
    expect(index.incoming(missing.node!.id)).toEqual([]);
  });
});

function fixtureDocuments(): readonly DocumentEnvelope[] {
  return [
    envelope({
      adapterId: "definition-markdown",
      kind: "spec",
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
      metadata: {
        defId: "checkout-spec",
        sourcePath: "docs/specs/checkout/checkout.spec.md",
        tags: ["checkout"],
        scope: "flow",
      },
      links: [
        { targetId: "checkout-child", type: "contains" },
        { targetId: "checkout-child", type: "contains" },
      ],
      sources: [
        {
          id: "implementation",
          path: "/repo/packages/checkout/src/index.ts",
          label: "checkout implementation",
          metadata: {
            sourceKind: "implementation",
          },
        },
      ],
      sections: [
        {
          id: "purpose",
          title: "Purpose",
          anchor: "^purpose",
        },
      ],
    }),
    envelope({
      adapterId: "definition-markdown",
      kind: "spec",
      stableId: "checkout-child",
      familyId: "docs/specs/checkout/child",
      path: "docs/specs/checkout/checkout-child.spec.md",
      metadata: {
        defId: "checkout-child",
        sourcePath: "docs/specs/checkout/checkout-child.spec.md",
      },
      links: [
        { targetId: "checkout-spec", type: "depends_on" },
      ],
    }),
    envelope({
      adapterId: "definition-markdown",
      kind: "rule",
      stableId: "checkout-rule",
      familyId: "docs/specs/checkout",
      path: "docs/specs/checkout/checkout.rule.md",
      metadata: {
        defId: "checkout-rule",
        sourcePath: "docs/specs/checkout/checkout.rule.md",
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
          id: "US-003",
          title: "Build document coordinate graph index",
          evidenceIds: ["checkout-evidence"],
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
          id: "US-003",
          title: "Build document coordinate graph index",
          metadata: {
            dependsOn: [],
            passes: true,
          },
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
        sourceRefs: ["/repo/packages/checkout/src/index.ts"],
        verificationRefs: ["packages/checkout/src/index.test.ts"],
        relations: [
          {
            kind: "verifies",
            fromRef: "checkout-evidence",
            toRef: "checkout-spec",
            evidenceRef: "checkout-evidence",
          },
        ],
      },
      links: [
        { targetId: "checkout-spec", type: "verifies" },
      ],
      sources: [
        {
          id: "source-ref:1",
          path: "/repo/packages/checkout/src/index.ts",
          metadata: {
            sourceKind: "source_ref",
          },
        },
        {
          id: "verification-ref:1",
          path: "packages/checkout/src/index.test.ts",
          metadata: {
            sourceKind: "verification_ref",
          },
        },
      ],
      evidence: [
        {
          id: "checkout-evidence",
          kind: "activation-evidence",
          summary: "Checkout activation evidence",
          metadata: {
            artifactId: "checkout-evidence",
          },
        },
      ],
    }),
  ];
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

function nodeIds(
  nodes: readonly { readonly id: string }[] | undefined,
): readonly string[] {
  return (nodes ?? []).map((node) => node.id);
}
