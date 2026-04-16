import { describe, expect, it } from "vitest";

import {
  buildDocumentGraphIndex,
  CANONICAL_TRAVERSAL_AXES,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
  formatDocumentGraphTraversalRoleGroups,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
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
    expect(result.nodeCount).toBe(2);
    expect(result.edges).toHaveLength(1);
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

  it("groups role traversal for spec, todo, plan, rule, test, memo, and knowledge family members", () => {
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
