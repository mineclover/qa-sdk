import { describe, expect, it } from "vitest";

import {
  buildDocumentGraphIndex,
  BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING,
  CANONICAL_TRAVERSAL_AXES,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
  formatDocumentGraphTraversalRoleGroups,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  normalizeDocumentEnvelope,
  normalizeDocumentGraphTraversalInput,
  traverseDocumentGraph,
  type DocumentEnvelope,
  type DocumentEnvelopeInput,
  type DocumentGraphEdgeKind,
  type DocumentGraphEdgeSummary,
  type TraversalAxis,
} from "./index.js";

describe("docs-control-plane graph traversal", () => {
  it("normalizes traversal input defaults and preset expansion", () => {
    expect(normalizeDocumentGraphTraversalInput({ target: "root" })).toMatchObject({
      target: "root",
      axes: CANONICAL_TRAVERSAL_AXES.filter((axis) => axis !== "context"),
      direction: "out",
      depth: DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
      limit: DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
      includeContext: false,
    });

    expect(normalizeDocumentGraphTraversalInput({
      target: "root",
      axes: ["dependency"],
      preset: "implementation",
    })).toMatchObject({
      axes: ["dependency", "trace", "source", "evidence"],
      direction: "both",
      depth: 2,
      includeContext: false,
      preset: "implementation",
    });

    const capped = normalizeDocumentGraphTraversalInput({
      target: "root",
      depth: MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH + 10,
    });
    expect(capped.depth).toBe(MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH);
    expect(capped.diagnostics).toEqual([
      expect.stringContaining("depth capped"),
    ]);

    const limitCapped = normalizeDocumentGraphTraversalInput({
      target: "root",
      limit: MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT + 10,
    });
    expect(limitCapped.limit).toBe(MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT);
    expect(limitCapped.diagnostics).toEqual([
      expect.stringContaining("limit capped"),
    ]);

    expect(normalizeDocumentGraphTraversalInput({
      target: "root",
      axes: ["context"],
      includeContext: true,
    }).diagnostics).toContain(BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING);
  });

  it("expands each traversal preset to its canonical axes, direction, and default depth", () => {
    const expectedPresets = [
      {
        preset: "family",
        axes: ["composition", "role"],
        direction: "both",
        depth: 2,
      },
      {
        preset: "implementation",
        axes: ["trace", "source", "evidence"],
        direction: "both",
        depth: 2,
      },
      {
        preset: "review",
        axes: ["dependency", "constraint", "evidence", "role"],
        direction: "both",
        depth: 2,
      },
      {
        preset: "impact",
        axes: ["dependency", "trace", "source", "evidence"],
        direction: "in",
        depth: 2,
      },
      {
        preset: "prd-completion",
        axes: ["trace", "source", "evidence"],
        direction: "both",
        depth: 2,
      },
    ] as const;

    for (const expected of expectedPresets) {
      expect(normalizeDocumentGraphTraversalInput({
        target: "root",
        preset: expected.preset,
      })).toMatchObject({
        target: "root",
        preset: expected.preset,
        axes: expected.axes,
        direction: expected.direction,
        depth: expected.depth,
        limit: DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
        includeContext: false,
      });
    }

    expect(normalizeDocumentGraphTraversalInput({
      target: "root",
      axes: ["context"],
      preset: "prd-completion",
    })).toMatchObject({
      axes: ["trace", "source", "evidence"],
      includeContext: false,
      diagnostics: ["context axis omitted because includeContext is false"],
    });
  });

  it("traverses each selected axis and omits context unless requested", () => {
    const index = fixtureIndex();

    for (const axis of CANONICAL_TRAVERSAL_AXES) {
      const result = traverseDocumentGraph(index, {
        target: "root",
        axes: [axis],
        includeContext: axis === "context",
      });

      expect(result.input.axes).toEqual(axis === "context" ? ["context"] : [axis]);
      expect(result.nodes.map((node) => node.id)).toContain(axisTargetNodeId(axis));
      expect([...new Set(result.edges.map((edge) => edge.axis))]).toEqual([axis]);
      expect(result.edges[0]?.reasons[0]).toMatchObject({
        reason: `${axis} edge`,
      });
    }

    const contextSuppressed = traverseDocumentGraph(index, {
      target: "root",
      axes: ["context"],
    });
    expect(contextSuppressed.input.axes).toEqual([]);
    expect(contextSuppressed.nodes.map((node) => node.id)).toEqual(["document:root"]);
    expect(contextSuppressed.edges).toEqual([]);
  });

  it("supports out, in, and both directions", () => {
    const index = fixtureIndex();

    expect(traverseDocumentGraph(index, {
      target: "root",
      axes: ["dependency"],
      direction: "out",
    }).nodes.map((node) => node.id)).toEqual([
      "document:root",
      "document:dependency-out",
    ]);

    const incoming = traverseDocumentGraph(index, {
      target: "root",
      axes: ["dependency"],
      direction: "in",
    });
    expect(incoming.nodes.map((node) => node.id)).toEqual([
      "document:root",
      "document:dependency-in",
    ]);
    expect(incoming.paths.find((path) => path.nodeId === "document:dependency-in")?.steps).toEqual([
      expect.objectContaining({
        direction: "in",
        canonicalFromNodeId: "document:dependency-in",
        canonicalToNodeId: "document:root",
      }),
    ]);

    expect(traverseDocumentGraph(index, {
      target: "root",
      axes: ["dependency"],
      direction: "both",
    }).nodes.map((node) => node.id)).toEqual([
      "document:root",
      "document:dependency-out",
      "document:dependency-in",
    ]);
  });

  it("uses depth 1 by default and follows deeper paths when requested", () => {
    const index = fixtureIndex();

    const defaultDepth = traverseDocumentGraph(index, {
      target: "root",
      axes: ["composition"],
    });
    expect(defaultDepth.nodes.map((node) => node.id)).toContain("document:composition-out");
    expect(defaultDepth.nodes.map((node) => node.id)).not.toContain("document:composition-depth-2");
    expect(defaultDepth.truncated).toBe(true);
    expect(defaultDepth.omittedCounts).toMatchObject({
      depth: 1,
    });

    const depthTwo = traverseDocumentGraph(index, {
      target: "root",
      axes: ["composition"],
      depth: 2,
    });
    expect(depthTwo.nodes.find((node) => node.id === "document:composition-depth-2")).toMatchObject({
      depth: 2,
      pathFromTarget: {
        nodeIds: [
          "document:root",
          "document:composition-out",
          "document:composition-depth-2",
        ],
      },
    });
  });

  it("uses the default node limit and lets --limit lower or raise it within the safe maximum", () => {
    const childCount = DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT + 5;
    const index = wideFixtureIndex(childCount);

    const defaultLimit = traverseDocumentGraph(index, {
      target: "wide-root",
      axes: ["dependency"],
    });
    expect(defaultLimit.input.limit).toBe(DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT);
    expect(defaultLimit.nodes).toHaveLength(DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT);
    expect(defaultLimit.truncated).toBe(true);
    expect(defaultLimit.omittedCount).toBe(childCount + 1 - DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT);
    expect(defaultLimit.omittedCounts).toMatchObject({
      nodes: childCount + 1 - DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
    });

    const lowered = traverseDocumentGraph(index, {
      target: "wide-root",
      axes: ["dependency"],
      limit: 3,
    });
    expect(lowered.nodes).toHaveLength(3);
    expect(lowered.omittedCounts.nodes).toBe(childCount - 2);

    const raisedLimit = DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT + 3;
    const raised = traverseDocumentGraph(index, {
      target: "wide-root",
      axes: ["dependency"],
      limit: raisedLimit,
    });
    expect(raised.input.limit).toBe(raisedLimit);
    expect(raised.nodes).toHaveLength(raisedLimit);
  });

  it("caps returned nodes with truncation and omitted counts", () => {
    const index = fixtureIndex();

    const result = traverseDocumentGraph(index, {
      target: "root",
      axes: ["composition"],
      limit: 2,
    });

    expect(result.nodes.map((node) => node.id)).toEqual([
      "document:root",
      "document:composition-extra-a",
    ]);
    expect(result.truncated).toBe(true);
    expect(result.omittedCount).toBe(2);
    expect(result.omittedCounts).toMatchObject({
      nodes: 2,
      depth: 1,
    });
    expect(result.nodeCount).toBe(2);
    expect(result.edges).toHaveLength(1);
  });

  it("enforces the maximum depth and reports depth-frontier omissions", () => {
    const index = chainFixtureIndex(MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH + 2);

    const result = traverseDocumentGraph(index, {
      target: "chain-0",
      axes: ["dependency"],
      depth: MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH + 10,
      limit: MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH + 10,
    });

    expect(result.input.depth).toBe(MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH);
    expect(result.diagnostics).toEqual([
      expect.stringContaining("depth capped"),
    ]);
    expect(result.nodes.map((node) => node.id)).toContain(
      `document:chain-${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH}`,
    );
    expect(result.nodes.map((node) => node.id)).not.toContain(
      `document:chain-${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH + 1}`,
    );
    expect(result.truncated).toBe(true);
    expect(result.omittedCounts).toMatchObject({
      depth: 1,
    });
  });

  it("does not revisit nodes indefinitely across cycles", () => {
    const index = fixtureIndex();

    const result = traverseDocumentGraph(index, {
      target: "cycle-a",
      axes: ["trace"],
      direction: "out",
      depth: MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
      limit: 20,
    });

    expect(result.truncated).toBe(false);
    expect(result.nodes.map((node) => node.id)).toEqual([
      "document:cycle-a",
      "document:cycle-b",
      "document:cycle-c",
    ]);
    expect(result.nodes.find((node) => node.id === "document:cycle-a")?.depth).toBe(0);
    expect(result.paths.find((path) => path.nodeId === "document:cycle-c")).toMatchObject({
      depth: 2,
      nodeIds: ["document:cycle-a", "document:cycle-b", "document:cycle-c"],
    });
  });

  it("groups role traversal for spec, todo, plan, rule, cases, test, memo, and knowledge family members", () => {
    const index = buildDocumentGraphIndex(roleFixtureDocuments());

    const result = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["role"],
      direction: "out",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.missingRoles).toEqual([]);
    expect(result.roleGroups.map((group) => group.roleType)).toEqual(
      DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
    );
    expect(roleGroupStableIds(result, "spec")).toEqual(["checkout-spec"]);
    expect(roleGroupStableIds(result, "todo")).toEqual(["checkout-todo"]);
    expect(roleGroupStableIds(result, "plan")).toEqual(["checkout-plan"]);
    expect(roleGroupStableIds(result, "rule")).toEqual(["checkout-rule"]);
    expect(roleGroupStableIds(result, "cases")).toEqual(["checkout-cases"]);
    expect(roleGroupStableIds(result, "test")).toEqual(["checkout-test"]);
    expect(roleGroupStableIds(result, "memo")).toEqual(["checkout-memo"]);
    expect(roleGroupStableIds(result, "knowledge")).toEqual([
      "checkout-context-guide",
      "checkout-knowledge",
    ]);
    expect(result.roleGroups.find((group) => group.roleType === "knowledge")?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stableId: "checkout-knowledge",
          documentKind: "spec",
          extension: ".spec.md",
          familyIds: ["docs/specs/checkout/checkout"],
        }),
        expect.objectContaining({
          stableId: "checkout-context-guide",
          documentKind: "spec",
          extension: ".spec.md",
          familyIds: ["docs/specs/checkout/checkout"],
        }),
      ]),
    );

    const lines = formatDocumentGraphTraversalRoleGroups(result);
    expect(lines.join("\n")).toContain("knowledge (2):");
    expect(lines.join("\n")).toContain(
      "checkout-knowledge .spec.md documentKind=spec family=docs/specs/checkout/checkout",
    );

    expect(index.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "role-membership",
          axis: "role",
          fromNodeId: "document:checkout-context-guide",
          toNodeId: "document:checkout-spec",
          authoredType: "family-context",
        }),
        expect.objectContaining({
          kind: "document-constraint",
          axis: "constraint",
          fromNodeId: "document:checkout-rule",
          toNodeId: "document:checkout-spec",
        }),
      ]),
    );

    const constraintResult = traverseDocumentGraph(index, {
      target: "checkout-rule",
      axes: ["constraint"],
      direction: "out",
    });
    expect(constraintResult.nodes.map((node) => node.id)).toEqual([
      "document:checkout-rule",
      "document:checkout-spec",
    ]);
  });

  it("reports absent family roles as optional metadata instead of diagnostics", () => {
    const index = buildDocumentGraphIndex([
      roleDocument("checkout-spec", "spec", "checkout.spec.md"),
      roleDocument("checkout-todo", "todo", "checkout.todo.md"),
    ]);

    const result = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["role"],
      direction: "out",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.missingRoles).toEqual(
      expect.arrayContaining([
        {
          familyId: "docs/specs/checkout/checkout",
          roleType: "plan",
          optional: true,
          reason: "optional-absence",
        },
        {
          familyId: "docs/specs/checkout/checkout",
          roleType: "cases",
          optional: true,
          reason: "optional-absence",
        },
        {
          familyId: "docs/specs/checkout/checkout",
          roleType: "knowledge",
          optional: true,
          reason: "optional-absence",
        },
      ]),
    );
    expect(formatDocumentGraphTraversalRoleGroups(result).join("\n")).toContain(
      "optional missing in docs/specs/checkout/checkout",
    );
  });

  it("traverses source paths from either side and bounds uncovered source targets", () => {
    const index = buildDocumentGraphIndex(sourceEvidenceTraceDocuments(), {
      rootDir: "/repo",
    });

    const fromSourcePath = traverseDocumentGraph(index, {
      target: "/repo/packages/checkout/src/index.ts",
      axes: ["source"],
      direction: "in",
      depth: 1,
    });

    expect(fromSourcePath.targetResolution.lookupKind).toBe("source-path");
    expect(traversalNodeIds(fromSourcePath)).toEqual(expect.arrayContaining([
      "source:packages/checkout/src/index.ts",
      "document:checkout-spec",
      "document:checkout-proof",
    ]));
    expect(uniqueEdgeAxes(fromSourcePath)).toEqual(["source"]);

    const fromDocument = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["source"],
      direction: "out",
      depth: 1,
    });
    expect(traversalNodeIds(fromDocument)).toEqual(expect.arrayContaining([
      "source:packages/checkout/src/index.ts",
      "source:packages/checkout/src/index.test.ts",
    ]));
    expect(fromDocument.edges.map((edge) => edge.authoredType)).toEqual(
      expect.arrayContaining(["implementation", "test"]),
    );

    const missing = traverseDocumentGraph(index, {
      target: "/repo/packages/missing/src/nope.ts",
      axes: ["source"],
      direction: "both",
    });
    expect(missing.targetResolution.lookupKind).toBe("source-path-missing");
    expect(missing.nodeCount).toBe(1);
    expect(missing.edgeCount).toBe(0);
    expect(missing.truncated).toBe(false);
    expect(missing.diagnostics.join("\n")).toContain("source-map-missing");
  });

  it("traverses evidence records to proof, outputs, and verification refs", () => {
    const index = buildDocumentGraphIndex(sourceEvidenceTraceDocuments(), {
      rootDir: "/repo",
    });

    const fromEvidence = traverseDocumentGraph(index, {
      target: "checkout-proof",
      axes: ["evidence", "source"],
      direction: "both",
      depth: 2,
    });

    expect(traversalNodeIds(fromEvidence)).toEqual(expect.arrayContaining([
      "document:checkout-spec",
      "document:checkout-proof",
      "evidence:checkout-proof",
      "source:artifacts/checkout-output.json",
      "source:packages/checkout/src/index.ts",
      "source:packages/checkout/src/index.test.ts",
    ]));
    expect(fromEvidence.edges.filter((edge) => edge.axis === "evidence").map((edge) => edge.authoredType)).toEqual(
      expect.arrayContaining(["verifies", "materializes_output", "verificationRefs"]),
    );
    expect(fromEvidence.edges.filter((edge) => edge.axis === "source").map((edge) => edge.authoredType)).toEqual(
      expect.arrayContaining(["source_ref", "verification_ref"]),
    );

    const fromDocument = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["evidence"],
      direction: "both",
      depth: 2,
    });
    expect(traversalNodeIds(fromDocument)).toEqual(expect.arrayContaining([
      "document:checkout-proof",
      "evidence:checkout-proof",
    ]));
    expect(uniqueEdgeAxes(fromDocument)).toEqual(["evidence"]);
  });

  it("traverses PRD trace history without collapsing it into source or evidence", () => {
    const index = buildDocumentGraphIndex(sourceEvidenceTraceDocuments(), {
      rootDir: "/repo",
    });

    const result = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["trace"],
      direction: "both",
      depth: 3,
    });

    expect(uniqueEdgeAxes(result)).toEqual(["trace"]);
    expect(traversalNodeIds(result)).toEqual(expect.arrayContaining([
      "document:tasks/checkout-prd",
      "task:tasks/checkout-prd:US-006",
      "document:checkout-todo",
      "document:ralph-session:session-1",
    ]));
    expect(result.nodes.map((node) => node.kind)).not.toContain("source");
    expect(result.nodes.map((node) => node.kind)).not.toContain("evidence");
    expect(adapterIdsForNode(result, "document:tasks/checkout-prd")).toEqual(
      expect.arrayContaining(["prd-markdown", "ralph-prd-json"]),
    );
    expect(adapterIdsForNode(result, "task:tasks/checkout-prd:US-006")).toEqual(
      expect.arrayContaining(["prd-markdown", "ralph-prd-json"]),
    );
  });

  it("keeps trace, source, and evidence as distinct edge sets for the same target", () => {
    const index = buildDocumentGraphIndex(sourceEvidenceTraceDocuments(), {
      rootDir: "/repo",
    });

    const trace = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["trace"],
      direction: "both",
      depth: 1,
    });
    const source = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["source"],
      direction: "both",
      depth: 1,
    });
    const evidence = traverseDocumentGraph(index, {
      target: "checkout-spec",
      axes: ["evidence"],
      direction: "both",
      depth: 1,
    });

    expect(uniqueEdgeAxes(trace)).toEqual(["trace"]);
    expect(uniqueEdgeAxes(source)).toEqual(["source"]);
    expect(uniqueEdgeAxes(evidence)).toEqual(["evidence"]);
    expect(edgeIds(trace)).not.toEqual(edgeIds(source));
    expect(edgeIds(trace)).not.toEqual(edgeIds(evidence));
    expect(edgeIds(source)).not.toEqual(edgeIds(evidence));
  });
});

function fixtureIndex() {
  return buildDocumentGraphIndex(fixtureDocuments(), {
    includeContext: true,
    edges: [
      graphEdge("composition", "document:root", "document:composition-extra-a"),
      graphEdge("composition", "document:root", "document:composition-extra-b"),
      graphEdge("composition", "document:root", "document:composition-out"),
      graphEdge("composition", "document:composition-out", "document:composition-depth-2"),
      graphEdge("refinement", "document:root", "document:refinement-out"),
      graphEdge("dependency", "document:root", "document:dependency-out"),
      graphEdge("dependency", "document:dependency-in", "document:root"),
      graphEdge("constraint", "document:root", "document:constraint-out"),
      graphEdge("trace", "document:root", "document:trace-out"),
      graphEdge("trace", "document:cycle-a", "document:cycle-b"),
      graphEdge("trace", "document:cycle-b", "document:cycle-c"),
      graphEdge("trace", "document:cycle-c", "document:cycle-a"),
      graphEdge("source", "document:root", "source:packages/root.ts"),
      graphEdge("evidence", "document:root", "evidence:root-proof"),
      graphEdge("role", "document:root", "document:role-out"),
      graphEdge("context", "document:root", "context:tag:root"),
    ],
  });
}

function wideFixtureIndex(childCount: number) {
  const ids = [
    "wide-root",
    ...Array.from({ length: childCount }, (_, index) => `wide-${index}`),
  ];
  return buildDocumentGraphIndex(ids.map((stableId) => envelope(stableId)), {
    edges: Array.from({ length: childCount }, (_, index) =>
      graphEdge("dependency", "document:wide-root", `document:wide-${index}`)
    ),
  });
}

function chainFixtureIndex(nodeCount: number) {
  const ids = Array.from({ length: nodeCount }, (_, index) => `chain-${index}`);
  return buildDocumentGraphIndex(ids.map((stableId) => envelope(stableId)), {
    edges: Array.from({ length: Math.max(0, nodeCount - 1) }, (_, index) =>
      graphEdge("dependency", `document:chain-${index}`, `document:chain-${index + 1}`)
    ),
  });
}

function fixtureDocuments(): readonly DocumentEnvelope[] {
  return [
    "root",
    "composition-out",
    "composition-extra-a",
    "composition-extra-b",
    "composition-depth-2",
    "refinement-out",
    "dependency-out",
    "dependency-in",
    "constraint-out",
    "trace-out",
    "role-out",
    "cycle-a",
    "cycle-b",
    "cycle-c",
  ].map((stableId) => envelope(stableId));
}

function graphEdge(
  axis: TraversalAxis,
  fromNodeId: string,
  toNodeId: string,
): DocumentGraphEdgeSummary {
  return {
    id: `fixture:${axis}:${fromNodeId}->${toNodeId}`,
    kind: edgeKind(axis),
    axis,
    fromNodeId,
    toNodeId,
    authoredType: axis,
    reasons: [
      {
        adapterId: "fixture",
        reason: `${axis} edge`,
        rawSource: {
          path: "fixture.graph.json",
          pointer: `${fromNodeId}->${toNodeId}`,
          sourceSchema: "fixture",
        },
        sourceDocumentId: fromNodeId.replace(/^document:/, ""),
        sourceDocumentPath: `${fromNodeId.replace(/^document:/, "")}.md`,
        targetNodeId: toNodeId,
        targetNodePath: `${toNodeId}.md`,
        metadata: {
          axis,
        },
      },
    ],
    metadata: {
      fixture: true,
    },
  };
}

function edgeKind(axis: TraversalAxis): DocumentGraphEdgeKind {
  if (axis === "source") return "document-source";
  if (axis === "evidence") return "document-evidence";
  if (axis === "trace") return "task-trace";
  if (axis === "role") return "role-membership";
  if (axis === "context") return "context-metadata";
  if (axis === "constraint") return "document-constraint";
  return "authored-link";
}

function axisTargetNodeId(axis: TraversalAxis): string {
  if (axis === "source") return "source:packages/root.ts";
  if (axis === "evidence") return "evidence:root-proof";
  if (axis === "context") return "context:tag:root";
  return `document:${axis}-out`;
}

function envelope(stableId: string): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: "fixture",
    kind: "spec",
    stableId,
    familyId: "fixture",
    path: `${stableId}.md`,
    links: [],
    sources: [],
    sections: [],
    tasks: [],
    evidence: [],
    diagnostics: [],
    rawSource: {
      path: `${stableId}.md`,
      sourceSchema: "fixture",
    },
  } satisfies DocumentEnvelopeInput);
}

function roleFixtureDocuments(): readonly DocumentEnvelope[] {
  return [
    roleDocument("checkout-spec", "spec", "checkout.spec.md"),
    roleDocument("checkout-todo", "todo", "checkout.todo.md"),
    roleDocument("checkout-plan", "plan", "checkout.plan.md"),
    roleDocument("checkout-rule", "rule", "checkout.rule.md"),
    roleDocument("checkout-cases", "cases", "checkout.cases.md"),
    roleDocument("checkout-test", "test", "checkout.test.md"),
    roleDocument("checkout-memo", "memo", "checkout.memo.md"),
    roleDocument("checkout-knowledge", "spec", "checkout-knowledge.spec.md", {
      type: "knowledge",
      knowledgeKind: "guide",
      documentKind: "spec",
    }),
    roleDocument("checkout-context-guide", "spec", "checkout-context-guide.spec.md", {
      type: "knowledge",
      knowledgeKind: "guide",
      documentKind: "spec",
      noFamilyId: true,
      links: [
        { targetId: "checkout-spec", type: "refines" },
      ],
    }),
  ];
}

function roleGroupStableIds(
  result: ReturnType<typeof traverseDocumentGraph>,
  roleType: (typeof DOCUMENT_GRAPH_FAMILY_ROLE_TYPES)[number],
): readonly string[] {
  return result.roleGroups.find((group) => group.roleType === roleType)
    ?.nodes.map((node) => node.stableId ?? node.id)
    ?? [];
}

function roleDocument(
  stableId: string,
  kind: string,
  fileName: string,
  options: {
    readonly type?: string;
    readonly knowledgeKind?: string;
    readonly documentKind?: string;
    readonly noFamilyId?: boolean;
    readonly links?: DocumentEnvelopeInput["links"];
  } = {},
): DocumentEnvelope {
  const path = `docs/specs/checkout/${fileName}`;
  return normalizeDocumentEnvelope({
    adapterId: "definition-markdown",
    kind,
    stableId,
    ...(options.noFamilyId ? {} : { familyId: "docs/specs/checkout/checkout" }),
    path,
    metadata: {
      defId: stableId,
      sourcePath: path,
      ...(options.type ? { type: options.type } : {}),
      ...(options.knowledgeKind ? { knowledgeKind: options.knowledgeKind } : {}),
      ...(options.documentKind ? { documentKind: options.documentKind } : {}),
    },
    links: options.links ?? [],
    sources: [],
    sections: [],
    tasks: [],
    evidence: [],
    diagnostics: [],
    rawSource: {
      path,
      sourceSchema: "definition-frontmatter",
      metadata: {
        defId: stableId,
      },
    },
  } satisfies DocumentEnvelopeInput);
}

function sourceEvidenceTraceDocuments(): readonly DocumentEnvelope[] {
  return [
    graphDocument({
      adapterId: "definition-markdown",
      kind: "spec",
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
      metadata: {
        defId: "checkout-spec",
        sourcePath: "docs/specs/checkout/checkout.spec.md",
      },
      links: [
        { targetId: "tasks/checkout-prd", type: "traces_to" },
      ],
      sources: [
        {
          id: "implementation",
          path: "/repo/packages/checkout/src/index.ts",
          metadata: { sourceKind: "implementation" },
        },
        {
          id: "test",
          path: "packages/checkout/src/index.test.ts",
          metadata: { sourceKind: "test" },
        },
      ],
    }),
    graphDocument({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "checkout-todo",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.todo.md",
      metadata: {
        defId: "checkout-todo",
        sourcePath: "docs/specs/checkout/checkout.todo.md",
      },
      links: [
        { targetId: "US-006", type: "traces_to" },
      ],
    }),
    graphDocument({
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
          id: "US-006",
          title: "Add source, evidence, and trace traversal",
        },
      ],
    }),
    graphDocument({
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
          id: "US-006",
          title: "Add source, evidence, and trace traversal",
          metadata: {
            dependsOn: [],
            passes: true,
          },
        },
      ],
    }),
    graphDocument({
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
    graphDocument({
      adapterId: "artifact-evidence",
      kind: "activation-evidence",
      stableId: "checkout-proof",
      familyId: "checkout-spec",
      path: "artifacts/checkout-proof.json",
      metadata: {
        artifactId: "checkout-proof",
        artifactRef: "artifacts/checkout-proof.json",
        outputPath: "artifacts/checkout-output.json",
        verifiesRefs: ["checkout-spec"],
        materializesOutputRefs: ["artifacts/checkout-output.json"],
        sourceRefs: ["/repo/packages/checkout/src/index.ts"],
        verificationRefs: ["packages/checkout/src/index.test.ts"],
      },
      links: [
        { targetId: "checkout-spec", type: "verifies" },
        { targetId: "artifacts/checkout-output.json", type: "materializes_output" },
      ],
      sources: [
        {
          id: "source-ref:1",
          path: "/repo/packages/checkout/src/index.ts",
          metadata: { sourceKind: "source_ref" },
        },
        {
          id: "verification-ref:1",
          path: "packages/checkout/src/index.test.ts",
          metadata: { sourceKind: "verification_ref" },
        },
      ],
      evidence: [
        {
          id: "checkout-proof",
          kind: "activation-evidence",
          summary: "Checkout traversal proof",
          metadata: {
            artifactId: "checkout-proof",
          },
        },
      ],
    }),
  ];
}

function graphDocument(
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

function traversalNodeIds(
  result: ReturnType<typeof traverseDocumentGraph>,
): readonly string[] {
  return result.nodes.map((node) => node.id);
}

function uniqueEdgeAxes(
  result: ReturnType<typeof traverseDocumentGraph>,
): readonly TraversalAxis[] {
  return [...new Set(result.edges.map((edge) => edge.axis))];
}

function edgeIds(
  result: ReturnType<typeof traverseDocumentGraph>,
): readonly string[] {
  return result.edges.map((edge) => edge.id).toSorted();
}

function adapterIdsForNode(
  result: ReturnType<typeof traverseDocumentGraph>,
  nodeId: string,
): readonly string[] {
  return result.nodes
    .find((node) => node.id === nodeId)
    ?.reasons.map((reason) => reason.adapterId)
    .filter((adapterId): adapterId is string => Boolean(adapterId))
    ?? [];
}
