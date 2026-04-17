import { describe, expect, it } from "vitest";

import { buildDocumentRoleMatrix } from "./role-matrix.js";
import { normalizeDocumentEnvelope } from "./normalize.js";
import type { DocumentEnvelope, DocumentEnvelopeInput } from "./types.js";

describe("docs-control-plane role matrix", () => {
  it("assembles same-family role coverage while excluding inactive PRDs and sessions", () => {
    const target = document({
      kind: "spec",
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
      metadata: { title: "Checkout Spec" },
    });
    const todo = document({
      kind: "todo",
      stableId: "checkout-todo",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.todo.md",
      metadata: { title: "Checkout Todo" },
    });
    const knowledge = document({
      kind: "spec",
      stableId: "checkout-knowledge",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout-knowledge.spec.md",
      metadata: { type: "knowledge", title: "Checkout Knowledge" },
    });
    const archivedPrd = document({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/archive/checkout-prd",
      familyId: "docs/specs/checkout/checkout",
      path: "tasks/archive/checkout-prd.md",
      metadata: { title: "Archived Checkout PRD" },
    });
    const session = document({
      adapterId: "ralph-session",
      kind: "ralph-session",
      stableId: "ralph-session:checkout",
      familyId: "docs/specs/checkout/checkout",
      path: ".ralph-tui/session-meta.json",
      metadata: { status: "running" },
    });

    const matrix = buildDocumentRoleMatrix([
      target,
      todo,
      knowledge,
      archivedPrd,
      session,
    ], { target });

    expect(matrix).toBeDefined();
    expect(matrix?.familyId).toBe("docs/specs/checkout/checkout");
    expect(role(matrix!, "spec")).toMatchObject({
      present: true,
      sameFamilyPresent: true,
      linkedPresent: false,
    });
    expect(role(matrix!, "todo").sameFamily).toEqual([
      expect.objectContaining({
        stableId: "checkout-todo",
        kind: "todo",
        path: "docs/specs/checkout/checkout.todo.md",
      }),
    ]);
    expect(role(matrix!, "knowledge").sameFamily).toEqual([
      expect.objectContaining({
        stableId: "checkout-knowledge",
        kind: "spec",
        path: "docs/specs/checkout/checkout-knowledge.spec.md",
      }),
    ]);
    expect(role(matrix!, "prd").sameFamily).toEqual([]);
    expect(role(matrix!, "ralph-prd-json").sameFamily).toEqual([]);
    expect(matrix?.missingSameFamilyRoles).toContain("prd");
    expect(JSON.stringify(matrix)).not.toContain("tasks/archive/checkout-prd.md");
    expect(JSON.stringify(matrix)).not.toContain(".ralph-tui/session-meta.json");
  });

  it("assembles linked role coverage from composition, refinement, and trace links", () => {
    const target = document({
      kind: "spec",
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
      metadata: { title: "Checkout Spec" },
      links: [
        { type: "contains", targetId: "checkout-child" },
        { type: "refines", targetId: "checkout-base" },
        { type: "traces_to", targetId: "US-001" },
      ],
    });
    const child = document({
      kind: "spec",
      stableId: "checkout-child",
      familyId: "docs/specs/checkout-child/checkout-child",
      path: "docs/specs/checkout-child/checkout-child.spec.md",
      metadata: { title: "Checkout Child" },
    });
    const base = document({
      kind: "spec",
      stableId: "checkout-base",
      familyId: "docs/specs/checkout-base/checkout-base",
      path: "docs/specs/checkout-base/checkout-base.spec.md",
      metadata: { title: "Checkout Base" },
    });
    const prd = document({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/checkout-prd",
      familyId: "tasks/checkout-prd",
      path: "tasks/checkout-prd.md",
      metadata: { title: "Checkout PRD" },
      tasks: [{ id: "US-001", title: "Implement checkout matrix" }],
    });
    const ralphJson = document({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/checkout-prd",
      familyId: "tasks/checkout-prd",
      path: "tasks/checkout-prd.json",
      metadata: { name: "Checkout PRD" },
      tasks: [{ id: "US-001", title: "Implement checkout matrix" }],
    });

    const matrix = buildDocumentRoleMatrix([
      target,
      child,
      base,
      prd,
      ralphJson,
    ], { target });

    expect(matrix).toBeDefined();
    expect(role(matrix!, "spec").linked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stableId: "checkout-child",
          relation: "composition",
          linkType: "contains",
          direction: "out",
          sourceDocumentId: "checkout-spec",
          targetId: "checkout-child",
        }),
        expect.objectContaining({
          stableId: "checkout-base",
          relation: "refinement",
          linkType: "refines",
          direction: "out",
          targetId: "checkout-base",
        }),
      ]),
    );
    expect(role(matrix!, "prd")).toMatchObject({
      present: true,
      sameFamilyPresent: false,
      linkedPresent: true,
    });
    expect(role(matrix!, "prd").linked).toEqual([
      expect.objectContaining({
        stableId: "tasks/checkout-prd",
        relation: "trace",
        linkType: "traces_to",
        direction: "out",
        targetId: "US-001",
      }),
    ]);
    expect(role(matrix!, "ralph-prd-json").linked).toEqual([
      expect.objectContaining({
        stableId: "tasks/checkout-prd",
        relation: "trace",
        linkType: "traces_to",
        direction: "out",
        targetId: "US-001",
      }),
    ]);
    expect(matrix?.missingRoles).not.toContain("prd");
    expect(matrix?.missingSameFamilyRoles).toEqual(
      expect.arrayContaining(["prd", "ralph-prd-json"]),
    );
  });
});

function role(
  matrix: NonNullable<ReturnType<typeof buildDocumentRoleMatrix>>,
  name: string,
): NonNullable<ReturnType<typeof buildDocumentRoleMatrix>>["roles"][number] {
  const match = matrix.roles.find((item) => item.role === name);
  expect(match).toBeDefined();
  return match!;
}

function document(input: Omit<DocumentEnvelopeInput, "adapterId" | "rawSource"> & {
  readonly adapterId?: string;
}): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: "definition-markdown",
    ...input,
    rawSource: {
      path: input.path,
    },
  });
}
