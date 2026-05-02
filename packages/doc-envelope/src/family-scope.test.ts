// @def.doc doc-envelope-test

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
      metadata: { status: "running", transient: true },
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
    ], { target, includeTransient: true });
    expect(sessionScope.documents.map((item) => item.stableId)).toContain("ralph-session:module");
    expect(sessionScope.reasonByDocumentKey.get(key(session))).toBe("family-only:transient");
  });

  it("includes direct group children for group targets", () => {
    const target = document({
      kind: "spec",
      stableId: "skill-catalog-system",
      familyId: "docs/specs/skill-catalog/skill-catalog-system",
      path: "docs/specs/skill-catalog/skill-catalog-system.md",
      metadata: { level: "group", title: "Skill Catalog System" },
      links: [{ type: "contains", targetId: "automation-skill-group" }],
    });
    const groupChild = document({
      kind: "spec",
      stableId: "automation-skill-group",
      familyId: "docs/specs/skill-catalog/automation-skill-group",
      path: "docs/specs/skill-catalog/automation-skill-group.md",
      metadata: { level: "group", title: "Automation Skill Group" },
    });

    const scope = collectDocumentFamilyOnlyScope([
      target,
      groupChild,
    ], { target });

    expect(scope.documents.map((item) => item.stableId)).toEqual([
      "automation-skill-group",
      "skill-catalog-system",
    ]);
    expect(scope.reasonByDocumentKey.get(key(groupChild))).toBe("family-only:contains");
  });

  it("includes direct contains children for tier system targets even without level metadata", () => {
    const target = document({
      kind: "spec",
      stableId: "programming-artifact-ontology-system",
      familyId: "docs/specs/operational-ontology/programming-artifact-ontology-system",
      path: "docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md",
      metadata: {
        defId: "programming-artifact-ontology-system",
        tier: "system",
        title: "Programming Artifact Ontology System",
      },
      links: [{ type: "contains", targetId: "programming-artifact-ontology-registry-provider" }],
    });
    const componentChild = document({
      kind: "spec",
      stableId: "programming-artifact-ontology-registry-provider",
      familyId: "docs/specs/operational-ontology/programming-artifact-ontology-registry-provider",
      path: "docs/specs/operational-ontology/programming-artifact-ontology-registry-provider.spec.md",
      metadata: {
        defId: "programming-artifact-ontology-registry-provider",
        tier: "component",
        title: "Programming Artifact Ontology Registry Provider",
      },
    });

    const scope = collectDocumentFamilyOnlyScope([
      target,
      componentChild,
    ], { target });

    expect(scope.documents.map((item) => item.stableId)).toEqual([
      "programming-artifact-ontology-registry-provider",
      "programming-artifact-ontology-system",
    ]);
    expect(scope.reasonByDocumentKey.get(key(componentChild))).toBe("family-only:contains");
  });

  it("includes direct refs children for layout targets", () => {
    const target = document({
      kind: "spec",
      stableId: "operational-ontology-component-plane",
      familyId: "docs/specs/operational-ontology/operational-ontology-component-plane",
      path: "docs/specs/operational-ontology/operational-ontology-component-plane.spec.md",
      metadata: { tier: "layout", title: "Component Plane" },
      links: [{ type: "refs", targetId: "operational-ontology-taxonomy-schema" }],
    });
    const referenced = document({
      kind: "spec",
      stableId: "operational-ontology-taxonomy-schema",
      familyId: "docs/specs/operational-ontology/operational-ontology-taxonomy-schema",
      path: "docs/specs/operational-ontology/operational-ontology-taxonomy-schema.spec.md",
      metadata: { title: "Taxonomy Schema" },
    });

    const scope = collectDocumentFamilyOnlyScope([
      target,
      referenced,
    ], { target });

    expect(scope.documents.map((item) => item.stableId)).toEqual([
      "operational-ontology-component-plane",
      "operational-ontology-taxonomy-schema",
    ]);
    expect(scope.reasonByDocumentKey.get(key(referenced))).toBe("family-only:refs");
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
