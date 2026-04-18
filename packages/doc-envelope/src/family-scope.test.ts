import { describe, expect, it } from "vitest";

import { collectDocumentFamilyOnlyScope } from "./family-scope.js";
import { normalizeDocumentEnvelope } from "./normalize.js";
import type { DocumentEnvelope, DocumentEnvelopeInput } from "./types.js";

describe("docs-control-plane family-only scope", () => {
  it("keeps active role families and direct module children while excluding archives and sessions by default", () => {
    const target = document({
      kind: "spec",
      stableId: "module-spec",
      familyId: "docs/specs/module/module",
      path: "docs/specs/module/module.spec.md",
      metadata: { level: "module", title: "Module Spec" },
      links: [{ type: "contains", targetId: "module-child" }],
    });
    const sameFamilyTodo = document({
      kind: "todo",
      stableId: "module-todo",
      familyId: "docs/specs/module/module",
      path: "docs/specs/module/module.todo.md",
      metadata: { title: "Module Todo" },
    });
    const directChild = document({
      kind: "spec",
      stableId: "module-child",
      familyId: "docs/specs/module-child/module-child",
      path: "docs/specs/module/module-child.spec.md",
      metadata: { level: "leaf", title: "Module Child" },
    });
    const unrelatedDependency = document({
      kind: "spec",
      stableId: "checkout-spec",
      familyId: "docs/specs/checkout/checkout",
      path: "docs/specs/checkout/checkout.spec.md",
      metadata: { title: "Checkout Spec" },
    });
    const archivedPrd = document({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/archive/module-prd",
      familyId: "docs/specs/module/module",
      path: "tasks/archive/module-prd.md",
      metadata: { title: "Archived Module PRD" },
    });
    const session = document({
      adapterId: "ralph-session",
      kind: "ralph-session",
      stableId: "ralph-session:module",
      familyId: "docs/specs/module/module",
      path: ".ralph-tui/session-meta.json",
      metadata: { status: "running" },
    });

    const scope = collectDocumentFamilyOnlyScope([
      target,
      sameFamilyTodo,
      directChild,
      unrelatedDependency,
      archivedPrd,
      session,
    ], { target });

    expect(scope.documents.map((item) => item.stableId)).toEqual([
      "module-child",
      "module-spec",
      "module-todo",
    ]);
    expect(scope.reasonByDocumentKey.get(key(target))).toBe("target");
    expect(scope.reasonByDocumentKey.get(key(sameFamilyTodo))).toBe("family-only:role");
    expect(scope.reasonByDocumentKey.get(key(directChild))).toBe("family-only:contains");
    expect(scope.reasonByDocumentKey.has(key(archivedPrd))).toBe(false);
    expect(scope.reasonByDocumentKey.has(key(session))).toBe(false);

    const sessionScope = collectDocumentFamilyOnlyScope([
      target,
      sameFamilyTodo,
      directChild,
      session,
    ], { target, includeSession: true });
    expect(sessionScope.documents.map((item) => item.stableId)).toContain("ralph-session:module");
    expect(sessionScope.reasonByDocumentKey.get(key(session))).toBe("family-only:session");
  });
});

function key(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
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
