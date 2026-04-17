import { describe, expect, it } from "vitest";

import type { CompletedRecordState } from "./completed-records.js";
import { findNextFollowUps } from "./follow-ups.js";
import { normalizeDocumentEnvelope } from "./normalize.js";
import type { DocumentEnvelope, DocumentEnvelopeInput } from "./types.js";

describe("docs-control-plane follow-up candidates", () => {
  it("ranks session, actionable, uncategorized, deferred, and parking-lot candidates", async () => {
    const todo = document({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "follow-up-todo",
      path: "docs/specs/follow-up/follow-up.todo.md",
      metadata: { title: "Follow Up Todo" },
    });
    const taskSource = document({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/follow-up-prd",
      path: "tasks/follow-up-prd.json",
      metadata: { name: "Follow Up PRD" },
      tasks: [
        {
          id: "US-OPEN",
          title: "Open PRD story.",
          status: "pending",
          metadata: {},
        },
        {
          id: "US-DONE",
          title: "Completed PRD story.",
          status: "passed",
          metadata: {},
        },
      ],
    });
    const session = document({
      adapterId: "ralph-session",
      kind: "ralph-session",
      stableId: "ralph-session",
      path: ".ralph-tui/session-meta.json",
      metadata: { status: "running" },
      diagnostics: [
        {
          code: "ralph-session-prd-complete-session-running",
          severity: "warning",
          message: "PRD is complete but the session is still running.",
          metadata: {},
        },
      ],
    });
    const completedTodo = document({
      adapterId: "definition-markdown",
      kind: "todo",
      stableId: "completed-todo",
      path: "docs/specs/follow-up/completed.todo.md",
      metadata: { title: "Completed Todo" },
    });
    const completedPrd = document({
      adapterId: "ralph-prd-json",
      kind: "ralph-prd-json",
      stableId: "tasks/completed-prd",
      path: "tasks/completed-prd.json",
      metadata: { name: "Completed PRD" },
      tasks: [
        {
          id: "US-SKIP",
          title: "Completed-record open story.",
          status: "pending",
          metadata: {},
        },
      ],
    });

    const followUps = await findNextFollowUps({
      rootDir: "/repo",
      documents: [todo, taskSource, session, completedTodo, completedPrd],
      completedRecords: [
        completedRecord(completedTodo),
        completedRecord(completedPrd),
      ],
      readDocument: async (item) => ({
        [todo.path]: `# Follow Up Todo

## Parking Lot — 후보 보관

- [ ] Parking item.

## Deferred — 조건부 대기

- [ ] Deferred item.

## 운영 메모

- [ ] Uncategorized item.

## Actionable — 실행 가능

- [ ] Todo actionable item.
`,
        [completedTodo.path]: "- [ ] Completed-record open item.\n",
      }[item.path] ?? null),
    });

    expect(followUps.map((followUp) => ({
      title: followUp.title,
      kind: followUp.kind,
      category: followUp.category,
    }))).toEqual([
      {
        title: "Ralph session follow-up",
        kind: "ralph-session",
        category: "actionable",
      },
      {
        title: "Todo actionable item.",
        kind: "todo",
        category: "actionable",
      },
      {
        title: "Open PRD story.",
        kind: "ralph-prd-json",
        category: "actionable",
      },
      {
        title: "Uncategorized item.",
        kind: "todo",
        category: "uncategorized",
      },
      {
        title: "Deferred item.",
        kind: "todo",
        category: "deferred",
      },
      {
        title: "Parking item.",
        kind: "todo",
        category: "parking-lot",
      },
    ]);
    expect(followUps.map((followUp) => followUp.title)).not.toContain("Completed PRD story.");
    expect(followUps.map((followUp) => followUp.title)).not.toContain("Completed-record open story.");
    expect(followUps.map((followUp) => followUp.title)).not.toContain("Completed-record open item.");
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

function completedRecord(document: DocumentEnvelope): CompletedRecordState {
  return {
    source: document.adapterId,
    kind: document.kind,
    documentId: document.stableId,
    path: document.path,
    state: "completed-record",
    title: String(document.metadata.title ?? document.metadata.name ?? document.stableId),
    reason: "test completed record",
  };
}
