import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  MOTION_COMPOSITION_SCHEMA_V1,
  type MotionCompositionDocumentV1,
  validateMotionCompositionDocument,
} from "motion-content";
import {
  MOTION_WORKSPACE_SCHEMA_V1,
  type MotionWorkspaceSnapshotV1,
  validateMotionWorkspaceSnapshot,
} from "motion-workspace";
import {
  describeError,
  formatWorkspaceSource,
  isRecord,
  type MotionCompositionSummary,
} from "./motion-shared.js";

export const MOTION_VALIDATE_USAGE = "Usage: qa-sdk motion validate <file>";
export const MOTION_INSPECT_USAGE = "Usage: qa-sdk motion inspect <file>";

type MotionDocumentKind = "composition" | "workspace";

interface MotionDocumentAnalysis {
  readonly filePath: string;
  readonly kind: MotionDocumentKind | "unknown";
  readonly issues: readonly string[];
  readonly value?: unknown;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function getFileArg(args: readonly string[], usage: string): string | null {
  const filePath = args[0];
  if (!filePath) {
    console.error(usage);
    return null;
  }
  return filePath;
}

function detectMotionDocumentKind(value: unknown): MotionDocumentKind | null {
  if (!isRecord(value)) {
    return null;
  }

  const schemaVersion = typeof value.schemaVersion === "string" ? value.schemaVersion : undefined;
  if (schemaVersion === MOTION_COMPOSITION_SCHEMA_V1) return "composition";
  if (schemaVersion === MOTION_WORKSPACE_SCHEMA_V1) return "workspace";

  if (hasOwn(value, "document") || hasOwn(value, "editor") || hasOwn(value, "revision") || hasOwn(value, "savedAt")) {
    return "workspace";
  }
  if (hasOwn(value, "composition")) {
    return "composition";
  }
  return null;
}

function analyzeMotionDocument(filePath: string, value: unknown): MotionDocumentAnalysis {
  const kind = detectMotionDocumentKind(value);
  if (kind === "composition") {
    return {
      filePath,
      kind,
      issues: validateMotionCompositionDocument(value),
      value,
    };
  }

  if (kind === "workspace") {
    return {
      filePath,
      kind,
      issues: [...validateMotionWorkspaceSnapshot(value)],
      value,
    };
  }

  return {
    filePath,
    kind: "unknown",
    issues: [
      `$.schemaVersion: ${MOTION_COMPOSITION_SCHEMA_V1} 또는 ${MOTION_WORKSPACE_SCHEMA_V1} 문서여야 합니다.`,
    ],
    value,
  };
}

async function readMotionDocument(filePath: string): Promise<MotionDocumentAnalysis> {
  const resolvedPath = resolve(filePath);
  const raw = await readFile(resolvedPath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const reason = describeError(error);
    return {
      filePath: resolvedPath,
      kind: "unknown",
      issues: [`$: JSON 파싱에 실패했습니다. ${reason}`],
    };
  }

  return analyzeMotionDocument(resolvedPath, parsed);
}

function summarizeComposition(document: MotionCompositionDocumentV1): MotionCompositionSummary {
  const composition = document.composition;
  return {
    id: composition.id,
    title: composition.title,
    durationMs: composition.durationMs,
    parameters: composition.parameters.length,
    assets: composition.assets.length,
    layers: composition.layers.length,
    sequences: composition.sequences.length,
    captions: composition.captions.length,
    transitions: composition.transitions.length,
  };
}

function printValidationResult(result: MotionDocumentAnalysis): void {
  const label = result.kind === "workspace"
    ? "motion workspace snapshot"
    : result.kind === "composition"
      ? "motion composition document"
      : "motion document";

  if (result.issues.length === 0) {
    console.log(`✓ 유효한 ${label}입니다.`);
    console.log(`  file: ${result.filePath}`);
    return;
  }

  console.log(`✗ 유효하지 않은 ${label}입니다.`);
  console.log(`  file: ${result.filePath}`);
  for (const issue of result.issues) {
    console.log(`  - ${issue}`);
  }
  process.exitCode = 1;
}

function printCompositionInspect(filePath: string, document: MotionCompositionDocumentV1): void {
  const summary = summarizeComposition(document);

  console.log(`\n══ Motion Composition Document ══`);
  console.log(`  file: ${filePath}`);
  console.log(`  schemaVersion: ${document.schemaVersion}`);
  console.log(`  id: ${summary.id}`);
  console.log(`  title: ${summary.title}`);
  console.log(`  durationMs: ${summary.durationMs}`);
  console.log(`  parameters: ${summary.parameters}`);
  console.log(`  assets: ${summary.assets}`);
  console.log(`  layers: ${summary.layers}`);
  console.log(`  sequences: ${summary.sequences}`);
  console.log(`  captions: ${summary.captions}`);
  console.log(`  transitions: ${summary.transitions}`);
}

function printWorkspaceInspect(filePath: string, snapshot: MotionWorkspaceSnapshotV1): void {
  const summary = summarizeComposition(snapshot.document);
  const selection = snapshot.editor.selection
    ? `${snapshot.editor.selection.kind}:${snapshot.editor.selection.id}`
    : "(none)";

  console.log(`\n══ Motion Workspace Snapshot ══`);
  console.log(`  file: ${filePath}`);
  console.log(`  schemaVersion: ${snapshot.schemaVersion}`);
  console.log(`  revision: ${snapshot.revision}`);
  console.log(`  savedAt: ${snapshot.savedAt}`);
  console.log(`  source: ${formatWorkspaceSource(snapshot)}`);
  console.log(`  editor.values: ${Object.keys(snapshot.editor.values).length}`);
  console.log(`  editor.selection: ${selection}`);
  console.log(
    `  editor.viewport: zoom=${snapshot.editor.viewport.zoom}, left=${snapshot.editor.viewport.scrollLeftMs}ms, window=${snapshot.editor.viewport.visibleDurationMs}ms`,
  );
  console.log(`  editor.loop: ${snapshot.editor.loop}`);
  console.log(`  editor.playbackRate: ${snapshot.editor.playbackRate}`);
  console.log(`  composition.id: ${summary.id}`);
  console.log(`  composition.title: ${summary.title}`);
  console.log(`  composition.durationMs: ${summary.durationMs}`);
  console.log(`  composition.parameters: ${summary.parameters}`);
  console.log(`  composition.assets: ${summary.assets}`);
  console.log(`  composition.layers: ${summary.layers}`);
  console.log(`  composition.sequences: ${summary.sequences}`);
  console.log(`  composition.captions: ${summary.captions}`);
  console.log(`  composition.transitions: ${summary.transitions}`);
}

export async function motionValidate(args: string[]): Promise<void> {
  const filePath = getFileArg(args, MOTION_VALIDATE_USAGE);
  if (!filePath) {
    return;
  }

  try {
    const result = await readMotionDocument(filePath);
    printValidationResult(result);
  } catch (error) {
    console.error(`motion 문서 읽기 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionInspect(args: string[]): Promise<void> {
  const filePath = getFileArg(args, MOTION_INSPECT_USAGE);
  if (!filePath) {
    return;
  }

  try {
    const result = await readMotionDocument(filePath);
    if (result.issues.length > 0 || result.kind === "unknown" || result.value === undefined) {
      printValidationResult(result);
      return;
    }

    if (result.kind === "composition") {
      printCompositionInspect(result.filePath, result.value as MotionCompositionDocumentV1);
      return;
    }

    printWorkspaceInspect(result.filePath, result.value as MotionWorkspaceSnapshotV1);
  } catch (error) {
    console.error(`motion 문서 읽기 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}
