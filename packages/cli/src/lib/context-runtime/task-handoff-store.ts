// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { TaskHandoff, TaskHandoffStore } from 'context-runtime';

const STORE_VERSION = 'v1' as const;

interface TaskHandoffStoreFile {
  readonly version: typeof STORE_VERSION;
  readonly handoffs: readonly TaskHandoff[];
}

/**
 * Local composition-root adapter for the TaskHandoffStore port.
 *
 * Handoffs are reference-only records. The adapter stores a versioned JSON
 * envelope and replaces it through a same-directory rename so a partial write
 * cannot become the active store. It is intentionally not part of
 * context-runtime, which remains free of filesystem I/O.
 */
export class JsonTaskHandoffStore implements TaskHandoffStore {
  constructor(private readonly filePath: string) {}

  async save(handoff: TaskHandoff): Promise<void> {
    const normalized = normalizeHandoff(handoff);
    const handoffs = await this.readAll();
    const identity = handoffIdentity(normalized);
    if (!handoffs.some((candidate) => handoffIdentity(candidate) === identity)) {
      handoffs.push(normalized);
    }
    await this.writeAll(sortHandoffs(handoffs));
  }

  async findByTaskKey(taskKey: string): Promise<readonly TaskHandoff[]> {
    assertNonEmptyString(taskKey, 'taskKey');
    return (await this.readAll())
      .filter((handoff) => handoff.taskKey === taskKey)
      .map(cloneHandoff);
  }

  private async readAll(): Promise<TaskHandoff[]> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isFileNotFound(error)) return [];
      throw error;
    }

    if (raw.trim().length === 0) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      throw new Error(`Task Handoff store JSON이 유효하지 않습니다: ${this.filePath}`, {
        cause: error,
      });
    }

    if (!isRecord(parsed) || parsed.version !== STORE_VERSION || !Array.isArray(parsed.handoffs)) {
      throw new Error(`Task Handoff store 형식이 ${STORE_VERSION}이 아닙니다: ${this.filePath}`);
    }

    return sortHandoffs(
      parsed.handoffs.map((handoff, index) => parseStoredHandoff(handoff, `handoffs[${index}]`)),
    );
  }

  private async writeAll(handoffs: readonly TaskHandoff[]): Promise<void> {
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = join(directory, `.${basename(this.filePath)}.${randomUUID()}.tmp`);
    const document: TaskHandoffStoreFile = {
      version: STORE_VERSION,
      handoffs,
    };

    try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.filePath);
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }
  }
}

function normalizeHandoff(handoff: TaskHandoff): TaskHandoff {
  return parseStoredHandoff(handoff, 'handoff');
}

function parseStoredHandoff(value: unknown, path: string): TaskHandoff {
  if (!isRecord(value) || value.version !== STORE_VERSION) {
    throw new Error(`${path}.version가 ${STORE_VERSION}이어야 합니다`);
  }
  if ('conversationTranscript' in value) {
    throw new Error(`${path}에 conversationTranscript를 저장할 수 없습니다`);
  }

  const taskKey = requireString(value.taskKey, `${path}.taskKey`);
  const sourceRevision = requireString(value.sourceRevision, `${path}.sourceRevision`);
  const resultRevision = requireString(value.resultRevision, `${path}.resultRevision`);
  const manifestDigest = requireString(value.manifestDigest, `${path}.manifestDigest`);
  const factRefs = parseFactRefs(value.factRefs, `${path}.factRefs`);
  const evidenceRefs = parseStringArray(value.evidenceRefs, `${path}.evidenceRefs`);
  const unresolvedQuestions = parseStringArray(
    value.unresolvedQuestions,
    `${path}.unresolvedQuestions`,
  );

  let childTaskKeys: string[] | undefined;
  if (value.childTaskKeys !== undefined) {
    childTaskKeys = parseStringArray(value.childTaskKeys, `${path}.childTaskKeys`);
    if (new Set(childTaskKeys).size !== childTaskKeys.length) {
      throw new Error(`${path}.childTaskKeys에는 중복 값이 있을 수 없습니다`);
    }
  }

  let nextTask: TaskHandoff['nextTask'];
  if (value.nextTask !== undefined) {
    if (!isRecord(value.nextTask)) {
      throw new Error(`${path}.nextTask는 객체여야 합니다`);
    }
    nextTask = {
      taskKey: requireString(value.nextTask.taskKey, `${path}.nextTask.taskKey`),
      objective: requireString(value.nextTask.objective, `${path}.nextTask.objective`),
    };
  }

  return {
    version: STORE_VERSION,
    taskKey,
    sourceRevision,
    resultRevision,
    manifestDigest,
    factRefs,
    evidenceRefs: sortUnique(evidenceRefs),
    unresolvedQuestions: sortUnique(unresolvedQuestions),
    ...(childTaskKeys ? { childTaskKeys: [...childTaskKeys] } : {}),
    ...(nextTask ? { nextTask } : {}),
  };
}

function parseFactRefs(value: unknown, path: string): TaskHandoff['factRefs'] {
  if (!Array.isArray(value)) throw new Error(`${path}는 배열이어야 합니다`);
  return value
    .map((entry, index) => {
      if (!isRecord(entry)) throw new Error(`${path}[${index}]는 객체여야 합니다`);
      return {
        factKey: requireString(entry.factKey, `${path}[${index}].factKey`),
        revision: requireString(entry.revision, `${path}[${index}].revision`),
        evidenceRefs: sortUnique(
          parseStringArray(entry.evidenceRefs, `${path}[${index}].evidenceRefs`),
        ),
      };
    })
    .sort((left, right) => compareStrings(left.factKey, right.factKey));
}

function parseStringArray(value: unknown, path: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)
  ) {
    throw new Error(`${path}는 문자열 배열이어야 합니다`);
  }
  return value as string[];
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path}는 비어 있지 않은 문자열이어야 합니다`);
  }
  return value;
}

function sortHandoffs(handoffs: readonly TaskHandoff[]): TaskHandoff[] {
  return [...handoffs].sort(
    (left, right) =>
      compareStrings(left.taskKey, right.taskKey) ||
      compareStrings(left.resultRevision, right.resultRevision) ||
      compareStrings(left.sourceRevision, right.sourceRevision) ||
      compareStrings(left.manifestDigest, right.manifestDigest),
  );
}

function handoffIdentity(handoff: TaskHandoff): string {
  return JSON.stringify(handoff);
}

function cloneHandoff(handoff: TaskHandoff): TaskHandoff {
  return {
    ...handoff,
    factRefs: handoff.factRefs.map((factRef) => ({
      ...factRef,
      evidenceRefs: [...factRef.evidenceRefs],
    })),
    evidenceRefs: [...handoff.evidenceRefs],
    unresolvedQuestions: [...handoff.unresolvedQuestions],
    ...(handoff.childTaskKeys ? { childTaskKeys: [...handoff.childTaskKeys] } : {}),
    ...(handoff.nextTask ? { nextTask: { ...handoff.nextTask } } : {}),
  };
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: string, name: string): void {
  if (value.trim().length === 0) throw new Error(`${name}는 비어 있을 수 없습니다`);
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
