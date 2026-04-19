// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { CompletedRecordState } from "doc-envelope";
import {
  CANONICAL_TODO_CATEGORY_LABELS,
  parseTodoFollowUps,
  type TodoFollowUpCategory,
} from "doc-envelope";
import type { DocumentEnvelope, DocumentTask } from "doc-envelope";

export interface FollowUpState {
  readonly source: string;
  readonly kind: string;
  readonly documentId: string;
  readonly path: string;
  readonly state: string;
  readonly title: string;
  readonly taskId?: string;
  readonly pointer?: string;
  readonly depth?: number;
  readonly parentTitle?: string;
  readonly headingPath?: readonly string[];
  readonly category?: TodoFollowUpCategory;
  readonly categoryLabel?: string;
  readonly reason: string;
}

export interface FollowUpDetectionOptions {
  readonly rootDir: string;
  readonly documents: readonly DocumentEnvelope[];
  readonly completedRecords: readonly CompletedRecordState[];
  readonly readDocument?: (document: DocumentEnvelope) => Promise<string | null>;
}

const CLOSED_TASK_STATES = new Set([
  "done",
  "closed",
  "complete",
  "completed",
  "pass",
  "passed",
  "passing",
  "true",
  "yes",
]);

export async function findNextFollowUps(
  options: FollowUpDetectionOptions,
): Promise<readonly FollowUpState[]> {
  const followUps: FollowUpState[] = [];
  const completedRecordPaths = new Set(options.completedRecords.map((record) => record.path));
  const sessionFollowUp = options.documents
    .flatMap((document) => document.diagnostics.map((diagnostic) => ({ document, diagnostic })))
    .find(({ diagnostic }) => diagnostic.code === "ralph-session-prd-complete-session-running");
  if (sessionFollowUp) {
    followUps.push({
      source: sessionFollowUp.document.adapterId,
      kind: sessionFollowUp.document.kind,
      documentId: sessionFollowUp.document.stableId,
      path: sessionFollowUp.document.path,
      state: String(sessionFollowUp.document.metadata.status ?? "running"),
      title: "Ralph session follow-up",
      category: "actionable",
      categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.actionable,
      reason: sessionFollowUp.diagnostic.message,
    });
  }

  for (const document of options.documents) {
    if (completedRecordPaths.has(document.path)) continue;
    for (const openTask of document.tasks.filter(isOpenTask)) {
      followUps.push({
        source: document.adapterId,
        kind: document.kind,
        documentId: document.stableId,
        path: document.path,
        taskId: openTask.id,
        state: taskState(openTask),
        title: openTask.title,
        category: "actionable",
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.actionable,
        reason: "open task state",
      });
    }
  }

  for (const todo of options.documents.filter((document) => document.kind === "todo")) {
    if (completedRecordPaths.has(todo.path)) continue;
    const content = await readFollowUpDocument(options, todo);
    const todoFollowUps = content
      ? parseTodoFollowUps(todo, content)
      : [{
        source: todo.adapterId,
        kind: todo.kind,
        documentId: todo.stableId,
        path: todo.path,
        state: String(todo.metadata.lifecycle ?? "todo"),
        title: titleOf(todo),
        category: "uncategorized" as const,
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.uncategorized,
        reason: "todo family member present",
      }];
    followUps.push(...todoFollowUps);
  }

  return followUps
    .toSorted(compareFollowUps)
    .filter((item, index, items) => index === items.findIndex((candidate) =>
      candidate.documentId === item.documentId
      && candidate.path === item.path
      && candidate.taskId === item.taskId
      && candidate.pointer === item.pointer
      && candidate.title === item.title
    ));
}

function compareFollowUps(left: FollowUpState, right: FollowUpState): number {
  return followUpRank(left) - followUpRank(right)
    || left.path.localeCompare(right.path)
    || (left.pointer ?? "").localeCompare(right.pointer ?? "")
    || left.title.localeCompare(right.title);
}

function followUpRank(followUp: FollowUpState): number {
  if (followUp.kind === "ralph-session") return 0;
  switch (followUp.category) {
    case "actionable": return 1;
    case "uncategorized": return 2;
    case "deferred": return 3;
    case "parking-lot": return 4;
    case "completed": return 5;
    default: return 5;
  }
}

async function readFollowUpDocument(
  options: FollowUpDetectionOptions,
  document: DocumentEnvelope,
): Promise<string | null> {
  if (options.readDocument) return options.readDocument(document);
  return readRepoFile(options.rootDir, document.path);
}

async function readRepoFile(rootDir: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolve(rootDir, normalizePath(path)), "utf8");
  } catch {
    return null;
  }
}

function isOpenTask(task: DocumentTask): boolean {
  const state = taskState(task);
  return !CLOSED_TASK_STATES.has(state.toLowerCase());
}

function taskState(task: DocumentTask): string {
  if (typeof task.status === "string" && task.status.trim()) return task.status.trim();
  if (task.metadata.passes === true) return "passed";
  if (task.metadata.passes === false) return "open";
  return "open";
}

function titleOf(document: DocumentEnvelope): string {
  for (const key of ["title", "name", "defId"] as const) {
    const value = document.metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return document.stableId;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}
