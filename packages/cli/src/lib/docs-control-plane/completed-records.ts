import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { countMarkdownCheckboxes } from "./todo-lifecycle.js";
import type { DocumentEnvelope } from "./types.js";

export interface CompletedRecordState {
  readonly source: string;
  readonly kind: string;
  readonly documentId: string;
  readonly path: string;
  readonly state: "completed-record";
  readonly title: string;
  readonly completedCount?: number;
  readonly openCount?: number;
  readonly pairedDocumentId?: string;
  readonly pairedPath?: string;
  readonly reason: string;
}

export interface CompletedRecordDetectionOptions {
  readonly rootDir: string;
  readonly documents: readonly DocumentEnvelope[];
  readonly readDocument?: (document: DocumentEnvelope) => Promise<string | null>;
}

export async function detectCompletedRecords(
  options: CompletedRecordDetectionOptions,
): Promise<readonly CompletedRecordState[]> {
  const records: CompletedRecordState[] = [];
  const activeDocuments = options.documents.filter(isActiveCompletedRecordDocument);
  const ralphPrdByFamilyId = new Map(
    activeDocuments
      .filter((document) => document.kind === "ralph-prd-json" && isAllStoriesPassing(document))
      .map((document) => [document.familyId ?? document.stableId, document]),
  );

  for (const document of activeDocuments) {
    if (document.kind === "todo" && document.path.endsWith(".todo.md")) {
      const content = await readCompletedRecordDocument(options, document);
      if (!content) continue;
      const checkboxState = countMarkdownCheckboxes(content);
      if (checkboxState.open > 0 || checkboxState.completed === 0) continue;
      records.push({
        source: document.adapterId,
        kind: document.kind,
        documentId: document.stableId,
        path: document.path,
        state: "completed-record",
        title: titleOf(document),
        completedCount: checkboxState.completed,
        openCount: checkboxState.open,
        reason: ".todo.md has completed checkboxes and no open checkboxes",
      });
      continue;
    }

    if (document.kind === "prd") {
      const paired = ralphPrdByFamilyId.get(document.familyId ?? document.stableId);
      if (!paired) continue;
      records.push({
        source: document.adapterId,
        kind: document.kind,
        documentId: document.stableId,
        path: document.path,
        state: "completed-record",
        title: titleOf(document),
        pairedDocumentId: paired.stableId,
        pairedPath: paired.path,
        reason: "paired PRD JSON has all stories passing",
      });
    }
  }

  return records
    .toSorted(compareCompletedRecords)
    .filter((item, index, items) => index === items.findIndex((candidate) =>
      candidate.documentId === item.documentId
      && candidate.path === item.path
      && candidate.kind === item.kind
    ));
}

async function readCompletedRecordDocument(
  options: CompletedRecordDetectionOptions,
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

function compareCompletedRecords(left: CompletedRecordState, right: CompletedRecordState): number {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.documentId.localeCompare(right.documentId);
}

function isActiveCompletedRecordDocument(document: DocumentEnvelope): boolean {
  if (document.metadata.lifecycle === "archived") return false;
  if (normalizePath(document.path).split("/").includes("archive")) return false;
  if (isTransientSessionDocument(document)) return false;
  return true;
}

function isTransientSessionDocument(document: DocumentEnvelope): boolean {
  return document.kind === "ralph-session"
    || normalizePath(document.path).startsWith(".ralph-tui/");
}

function isAllStoriesPassing(document: DocumentEnvelope): boolean {
  if (document.kind !== "ralph-prd-json") return false;
  const storyCount = asNumber(document.metadata.storyCount) ?? document.tasks.length;
  const passedStoryCount = asNumber(document.metadata.passedStoryCount)
    ?? document.tasks.filter((task) => task.metadata.passes === true).length;
  return storyCount > 0 && passedStoryCount === storyCount;
}

function titleOf(document: DocumentEnvelope): string {
  for (const key of ["title", "name", "defId"] as const) {
    const value = document.metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return document.stableId;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}
