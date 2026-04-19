// @def.doc ralph-tui-integration#ralph-session
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
} from "doc-envelope";
import { matchesDocumentQuery } from "doc-envelope";
import type {
  DocumentAdapter,
  DocumentCollectionQuery,
  DocumentDiagnosticInput,
  DocumentEnvelope,
  DocumentMetadata,
} from "doc-envelope";
import {
  readRalphPrdJsonSummary,
  type RalphPrdJsonSummary,
} from "./ralph-prd-json.js";

export const RALPH_SESSION_ADAPTER_ID = "ralph-session";

export interface RalphSessionAdapterOptions {
  readonly rootDir: string;
  readonly path?: string;
  readonly prdJsonPath?: string;
}

const DEFAULT_SESSION_PATH = ".ralph-tui/session-meta.json";

export function createRalphSessionAdapter(
  options: RalphSessionAdapterOptions,
): DocumentAdapter {
  const rootDir = options.rootDir;
  const sessionPath = options.path ?? DEFAULT_SESSION_PATH;

  return defineDocumentAdapter({
    id: RALPH_SESSION_ADAPTER_ID,
    async listDocuments(query?: DocumentCollectionQuery) {
      const envelope = await collectRalphSessionEnvelope(rootDir, sessionPath, options.prdJsonPath);
      const envelopes = envelope ? [envelope] : [];
      return envelopes.filter((item) => matchesDocumentQuery(item, query));
    },
    async getDocument(stableId: string) {
      const envelope = await collectRalphSessionEnvelope(rootDir, sessionPath, options.prdJsonPath);
      if (!envelope) return null;
      return envelope.stableId === stableId || envelope.metadata.id === stableId ? envelope : null;
    },
  });
}

async function collectRalphSessionEnvelope(
  rootDir: string,
  sessionPath: string,
  prdJsonPath: string | undefined,
): Promise<DocumentEnvelope | null> {
  const filePath = resolvePath(rootDir, sessionPath);
  const content = await safeRead(filePath);
  if (content === null) return null;
  return buildRalphSessionEnvelope(rootDir, filePath, content, prdJsonPath);
}

async function buildRalphSessionEnvelope(
  rootDir: string,
  filePath: string,
  content: string,
  prdJsonPath: string | undefined,
): Promise<DocumentEnvelope> {
  const relativePath = toRepoPath(rootDir, filePath);
  const diagnostics: DocumentDiagnosticInput[] = [];
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    diagnostics.push({
      code: "ralph-session-parse-error",
      severity: "error",
      message: error instanceof Error ? error.message : "Failed to parse ralph session metadata.",
      rawSource: {
        path: relativePath,
      },
      metadata: {
        source: RALPH_SESSION_ADAPTER_ID,
      },
    });
    value = {};
  }

  const root = isRecord(value) ? value : {};
  if (!isRecord(value)) {
    diagnostics.push({
      code: "ralph-session-root-not-object",
      severity: "error",
      message: "Ralph session metadata root must be an object.",
      rawSource: {
        path: relativePath,
      },
      metadata: {
        source: RALPH_SESSION_ADAPTER_ID,
      },
    });
  }

  const resolvedPrdPath = prdJsonPath ?? pickString(root.prdPath);
  const prdSummary = resolvedPrdPath
    ? await readRalphPrdJsonSummary(rootDir, resolvedPrdPath)
    : null;
  diagnostics.push(...detectSessionDrift(relativePath, root, prdSummary));

  const sessionId = pickString(root.id) ?? "session-meta";
  const metadata: DocumentMetadata = {
    ...root,
    sourcePath: relativePath,
    // `doc-envelope`의 family-scope 일반화 계약에 맞춰, ralph-tui 세션 문서는
    // 수집 시점에 `metadata.transient: true`를 스탬프한다. `.ralph-tui/` 경로
    // 하드코딩은 ralph-tui-integration 내부에만 존재한다.
    transient: true,
    ...(prdSummary ? {
      prdStoryCount: prdSummary.storyCount,
      prdPassedStoryCount: prdSummary.passedStoryCount,
      prdAllStoriesPassing: prdSummary.allStoriesPassing,
    } : {}),
  };

  return normalizeDocumentEnvelope({
    adapterId: RALPH_SESSION_ADAPTER_ID,
    kind: "ralph-session",
    stableId: `ralph-session:${sessionId}`,
    ...(resolvedPrdPath ? { familyId: resolvedPrdPath.replace(/\.json$/, "") } : {}),
    path: relativePath,
    metadata,
    diagnostics,
    rawSource: {
      path: relativePath,
      sourceSchema: "ralph-session-meta",
    },
  });
}

function detectSessionDrift(
  sourcePath: string,
  session: Record<string, unknown>,
  prdSummary: RalphPrdJsonSummary | null,
): readonly DocumentDiagnosticInput[] {
  if (!prdSummary) return [];
  const diagnostics: DocumentDiagnosticInput[] = [];
  const status = pickString(session.status);
  if (prdSummary.allStoriesPassing && status === "running") {
    diagnostics.push(toDiagnostic(sourcePath, "/status", "ralph-session-prd-complete-session-running", "warning", "PRD JSON has all stories passing but the ralph session is still running.", {
      prdPath: prdSummary.path,
    }));
  }

  const totalTasks = pickNumber(session.totalTasks);
  if (totalTasks !== undefined && totalTasks !== prdSummary.storyCount) {
    diagnostics.push(toDiagnostic(sourcePath, "/totalTasks", "ralph-session-total-tasks-drift", "warning", "Ralph session totalTasks disagrees with PRD JSON userStories count.", {
      prdPath: prdSummary.path,
      sessionTotalTasks: totalTasks,
      prdStoryCount: prdSummary.storyCount,
    }));
  }

  const tasksCompleted = pickNumber(session.tasksCompleted);
  if (tasksCompleted !== undefined && tasksCompleted !== prdSummary.passedStoryCount) {
    diagnostics.push(toDiagnostic(sourcePath, "/tasksCompleted", "ralph-session-completed-tasks-drift", "warning", "Ralph session tasksCompleted disagrees with PRD JSON passing story count.", {
      prdPath: prdSummary.path,
      sessionTasksCompleted: tasksCompleted,
      prdPassedStoryCount: prdSummary.passedStoryCount,
    }));
  }

  return diagnostics;
}

function toDiagnostic(
  sourcePath: string,
  pointer: string,
  code: string,
  severity: "warning" | "error",
  message: string,
  metadata: DocumentMetadata = {},
): DocumentDiagnosticInput {
  return {
    code,
    severity,
    message,
    rawSource: {
      path: sourcePath,
      pointer,
    },
    metadata: {
      source: RALPH_SESSION_ADAPTER_ID,
      ...metadata,
    },
  };
}

async function safeRead(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function resolvePath(rootDir: string, path: string): string {
  return path.startsWith("/") ? path : join(rootDir, path);
}

function toRepoPath(rootDir: string, filePath: string): string {
  return normalizePath(relative(rootDir, filePath));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
