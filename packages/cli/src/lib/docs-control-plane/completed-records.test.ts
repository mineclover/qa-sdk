import { describe, expect, it } from "vitest";

import { detectCompletedRecords } from "./completed-records.js";
import { normalizeDocumentEnvelope } from "./normalize.js";
import type { DocumentEnvelope, DocumentEnvelopeInput } from "./types.js";

describe("docs-control-plane completed record detection", () => {
  it("detects checked-only .todo.md records and preserves count fields", async () => {
    const completedTodo = document({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "event-taxonomy-rollout-todo",
      path: "docs/specs/event-vocab/event-taxonomy-rollout.todo.md",
      metadata: {
        title: "Event Taxonomy Rollout",
      },
    });
    const openTodo = document({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "open-rollout-todo",
      path: "docs/specs/event-vocab/open-rollout.todo.md",
      metadata: {
        title: "Open Rollout",
      },
    });
    const archivedTodo = document({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "archived-rollout-todo",
      path: "docs/specs/archive/archived-rollout.todo.md",
      metadata: {
        title: "Archived Rollout",
      },
    });

    const records = await detectCompletedRecords({
      rootDir: "/repo",
      documents: [completedTodo, openTodo, archivedTodo],
      readDocument: async (item) => ({
        [completedTodo.path]: "- [x] Seed events no longer hardcode service id.\n- [X] Event adoption read model exists.\n",
        [openTodo.path]: "- [x] Completed setup.\n- [ ] Publish follow-up.\n",
        [archivedTodo.path]: "- [x] Archived work.\n",
      }[item.path] ?? null),
    });

    expect(records).toEqual([
      {
        source: "definition-markdown",
        kind: "todo",
        documentId: "event-taxonomy-rollout-todo",
        path: "docs/specs/event-vocab/event-taxonomy-rollout.todo.md",
        state: "completed-record",
        title: "Event Taxonomy Rollout",
        completedCount: 2,
        openCount: 0,
        reason: ".todo.md has completed checkboxes and no open checkboxes",
      },
    ]);
  });

  it("detects completed PRD markdown records from paired passing ralph PRD JSON", async () => {
    const prd = document({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/checkout-prd",
      familyId: "tasks/checkout-prd",
      path: "tasks/checkout-prd.md",
      metadata: {
        title: "Checkout PRD",
      },
    });
    const passingJson = document({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/checkout-prd",
      familyId: "tasks/checkout-prd",
      path: "tasks/checkout-prd.json",
      metadata: {
        name: "Checkout PRD",
        storyCount: 2,
        passedStoryCount: 2,
      },
      tasks: [
        {
          id: "US-001",
          title: "Complete checkout docs",
          metadata: { passes: true },
        },
        {
          id: "US-002",
          title: "Validate checkout docs",
          metadata: { passes: true },
        },
      ],
    });
    const incompletePrd = document({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/inventory-prd",
      familyId: "tasks/inventory-prd",
      path: "tasks/inventory-prd.md",
      metadata: {
        title: "Inventory PRD",
      },
    });
    const incompleteJson = document({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/inventory-prd",
      familyId: "tasks/inventory-prd",
      path: "tasks/inventory-prd.json",
      metadata: {
        name: "Inventory PRD",
        storyCount: 2,
        passedStoryCount: 1,
      },
    });
    const archivedPrd = document({
      adapterId: "prd-markdown",
      kind: "prd",
      stableId: "tasks/archive/checkout-prd",
      familyId: "tasks/archive/checkout-prd",
      path: "tasks/archive/checkout-prd.md",
      metadata: {
        title: "Archived Checkout PRD",
      },
    });
    const archivedJson = document({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/archive/checkout-prd",
      familyId: "tasks/archive/checkout-prd",
      path: "tasks/archive/checkout-prd.json",
      metadata: {
        name: "Archived Checkout PRD",
        storyCount: 1,
        passedStoryCount: 1,
      },
    });

    const records = await detectCompletedRecords({
      rootDir: "/repo",
      documents: [prd, passingJson, incompletePrd, incompleteJson, archivedPrd, archivedJson],
    });

    expect(records).toEqual([
      {
        source: "prd-markdown",
        kind: "prd",
        documentId: "tasks/checkout-prd",
        path: "tasks/checkout-prd.md",
        state: "completed-record",
        title: "Checkout PRD",
        pairedDocumentId: "tasks/checkout-prd",
        pairedPath: "tasks/checkout-prd.json",
        reason: "paired PRD JSON has all stories passing",
      },
    ]);
  });
});

function document(input: Omit<DocumentEnvelopeInput, "rawSource">): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    ...input,
    rawSource: {
      path: input.path,
    },
  });
}
