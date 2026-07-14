// @def.doc doc-envelope

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { isTransientDocument } from './family-scope.js';
import { countMarkdownCheckboxes } from './todo-lifecycle.js';
import type { DocumentEnvelope } from './types.js';

export interface CompletedRecordState {
  readonly source: string;
  readonly kind: string;
  readonly documentId: string;
  readonly path: string;
  readonly state: 'completed-record';
  readonly title: string;
  readonly lifecycle?: string;
  readonly completedCount?: number;
  readonly openCount?: number;
  readonly storyCount?: number;
  readonly passedStoryCount?: number;
  readonly pairedDocumentId?: string;
  readonly pairedPath?: string;
  readonly reason: string;
}

export interface CompletedRecordDetectionOptions {
  readonly rootDir: string;
  readonly documents: readonly DocumentEnvelope[];
  readonly readDocument?: (document: DocumentEnvelope) => Promise<string | null>;
}

/**
 * `.todo.md` 파일 중 열린 체크박스 0 + 완료 체크박스 ≥ 1인 문서를 completed
 * record로 감지한다. 본 함수는 수집 계층에서 범용 TODO lifecycle만 다룬다.
 *
 * 특정 도구(ralph-tui 등)에서 정의된 PRD/JSON 완료 감지는 별도 패키지에서
 * 수행하며, 결과 배열은 caller가 merge한다 — `CompletedRecordState` shape는
 * 공유되지만 감지 로직은 소유 시스템이 책임진다.
 */
export async function detectCompletedRecords(
  options: CompletedRecordDetectionOptions,
): Promise<readonly CompletedRecordState[]> {
  const records: CompletedRecordState[] = [];
  const activeDocuments = options.documents.filter(isActiveCompletedRecordDocument);

  for (const document of activeDocuments) {
    if (document.kind !== 'todo' || !document.path.endsWith('.todo.md')) continue;
    const content = await readCompletedRecordDocument(options, document);
    if (!content) continue;
    const checkboxState = countMarkdownCheckboxes(content);
    if (checkboxState.open > 0 || checkboxState.completed === 0) continue;
    records.push({
      source: document.adapterId,
      kind: document.kind,
      documentId: document.stableId,
      path: document.path,
      state: 'completed-record',
      title: titleOf(document),
      ...lifecycleOf(document),
      completedCount: checkboxState.completed,
      openCount: checkboxState.open,
      reason: '.todo.md has completed checkboxes and no open checkboxes',
    });
  }

  return deduplicateCompletedRecords(records);
}

export function deduplicateCompletedRecords(
  records: readonly CompletedRecordState[],
): readonly CompletedRecordState[] {
  return [...records]
    .toSorted(compareCompletedRecords)
    .filter(
      (item, index, items) =>
        index ===
        items.findIndex(
          (candidate) =>
            candidate.documentId === item.documentId &&
            candidate.path === item.path &&
            candidate.kind === item.kind,
        ),
    );
}

export function isActiveCompletedRecordDocument(document: DocumentEnvelope): boolean {
  if (document.metadata.lifecycle === 'archived') return false;
  if (normalizePath(document.path).split('/').includes('archive')) return false;
  if (isTransientDocument(document)) return false;
  return true;
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
    return await readFile(resolve(rootDir, normalizePath(path)), 'utf8');
  } catch {
    return null;
  }
}

function compareCompletedRecords(left: CompletedRecordState, right: CompletedRecordState): number {
  return (
    left.path.localeCompare(right.path) ||
    left.kind.localeCompare(right.kind) ||
    left.documentId.localeCompare(right.documentId)
  );
}

function titleOf(document: DocumentEnvelope): string {
  for (const key of ['title', 'name', 'defId'] as const) {
    const value = document.metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return document.stableId;
}

function lifecycleOf(document: DocumentEnvelope): { readonly lifecycle?: string } {
  const lifecycle = document.metadata.lifecycle;
  return typeof lifecycle === 'string' && lifecycle.trim().length > 0
    ? { lifecycle: lifecycle.trim() }
    : {};
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/g, '/');
}
