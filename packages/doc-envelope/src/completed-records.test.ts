// @def.doc doc-envelope-test

import { describe, expect, it } from "vitest";

import { detectCompletedRecords } from "./completed-records.js";
import { normalizeDocumentEnvelope } from "./normalize.js";
import type { DocumentEnvelope, DocumentEnvelopeInput } from "./types.js";

describe("doc-envelope — completed record detection (generic .todo.md)", () => {
  it("detects checked-only .todo.md records and preserves count fields", async () => {
    const completedTodo = document({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "event-taxonomy-rollout-todo",
      path: "docs/specs/event-vocab/event-taxonomy-rollout.todo.md",
      metadata: {
        title: "Event Taxonomy Rollout",
        lifecycle: "draft",
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
    const emptyTodo = document({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "empty-rollout-todo",
      path: "docs/specs/event-vocab/empty-rollout.todo.md",
      metadata: {
        title: "Empty Rollout",
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
      documents: [completedTodo, openTodo, emptyTodo, archivedTodo],
      readDocument: async (item) => ({
        [completedTodo.path]: "- [x] Seed events no longer hardcode service id.\n- [X] Event adoption read model exists.\n",
        [openTodo.path]: "- [x] Completed setup.\n- [ ] Publish follow-up.\n",
        [emptyTodo.path]: "# Empty Rollout\n\nNo checklist items yet.\n",
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
        lifecycle: "draft",
        completedCount: 2,
        openCount: 0,
        reason: ".todo.md has completed checkboxes and no open checkboxes",
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
