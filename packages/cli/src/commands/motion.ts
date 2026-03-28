import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  MOTION_COMPOSITION_SCHEMA_V1,
  MOTION_COMPOSITION_SCHEMA_V2,
  type MotionCompositionDocumentV1,
  type MotionCompositionDocumentV2,
  validateMotionCompositionDocument,
} from "motion-content";
import {
  MOTION_WORKSPACE_SCHEMA_V1,
  MOTION_WORKSPACE_SCHEMA_V2,
  type MotionWorkspaceSnapshot,
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

type MotionCompositionDocument = MotionCompositionDocumentV1 | MotionCompositionDocumentV2;

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
  if (schemaVersion === MOTION_COMPOSITION_SCHEMA_V2) return "composition";
  if (schemaVersion === MOTION_WORKSPACE_SCHEMA_V1) return "workspace";
  if (schemaVersion === MOTION_WORKSPACE_SCHEMA_V2) return "workspace";

  if (
    hasOwn(value, "document")
    || hasOwn(value, "editor")
    || hasOwn(value, "revision")
    || hasOwn(value, "globalRevision")
    || hasOwn(value, "savedAt")
  ) {
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
      `$.schemaVersion: ${MOTION_COMPOSITION_SCHEMA_V1}, ${MOTION_COMPOSITION_SCHEMA_V2}, ${MOTION_WORKSPACE_SCHEMA_V1}, ${MOTION_WORKSPACE_SCHEMA_V2} 중 하나여야 합니다.`,
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

function isSceneComposition(
  document: MotionCompositionDocument,
): document is MotionCompositionDocumentV2 {
  return document.schemaVersion === MOTION_COMPOSITION_SCHEMA_V2;
}

function summarizeComposition(document: MotionCompositionDocument): MotionCompositionSummary {
  const composition = document.composition;
  if (isSceneComposition(document)) {
    return {
      id: composition.id,
      title: composition.title,
      durationMs: composition.durationMs,
      parameters: composition.parameters.length,
      assets: composition.assets.length,
      targets: "targets" in composition ? (composition as unknown as { targets: unknown[] }).targets.length : 0,
      scenes: "scenes" in composition ? (composition as unknown as { scenes: unknown[] }).scenes.length : 0,
      layers: "scenes" in composition ? (composition as unknown as { scenes: { layers: unknown[] }[] }).scenes.reduce((count: number, scene) => count + scene.layers.length, 0) : 0,
      sequences: "scenes" in composition ? (composition as unknown as { scenes: { sequences: unknown[] }[] }).scenes.reduce((count: number, scene) => count + scene.sequences.length, 0) : 0,
      captions: "scenes" in composition ? (composition as unknown as { scenes: { captions: unknown[] }[] }).scenes.reduce((count: number, scene) => count + scene.captions.length, 0) : 0,
      transitions: 0,
    };
  }

  return {
    id: composition.id,
    title: composition.title,
    durationMs: composition.durationMs,
    parameters: composition.parameters.length,
    assets: composition.assets.length,
    layers: "layers" in composition ? (composition as unknown as { layers: unknown[] }).layers.length : 0,
    sequences: "sequences" in composition ? (composition as unknown as { sequences: unknown[] }).sequences.length : 0,
    captions: "captions" in composition ? (composition as unknown as { captions: unknown[] }).captions.length : 0,
    transitions: "transitions" in composition ? (composition as unknown as { transitions: unknown[] }).transitions.length : 0,
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

function formatSelection(
  selection: MotionWorkspaceSnapshot["editor"]["selection"],
): string {
  if (!selection) {
    return "(none)";
  }
  if (selection.kind === "scene-layer") {
    return `${selection.kind}:${selection.sceneId}/${selection.targetId}`;
  }
  return `${selection.kind}:${selection.id}`;
}

function printCompositionInspect(filePath: string, document: MotionCompositionDocument): void {
  const summary = summarizeComposition(document);

  console.log(`\n══ Motion Composition Document ══`);
  console.log(`  file: ${filePath}`);
  console.log(`  schemaVersion: ${document.schemaVersion}`);
  console.log(`  id: ${summary.id}`);
  console.log(`  title: ${summary.title}`);
  console.log(`  durationMs: ${summary.durationMs}`);
  console.log(`  parameters: ${summary.parameters}`);
  console.log(`  assets: ${summary.assets}`);
  if (summary.targets !== undefined) {
    console.log(`  targets: ${summary.targets}`);
  }
  if (summary.scenes !== undefined) {
    console.log(`  scenes: ${summary.scenes}`);
  }
  console.log(`  layers: ${summary.layers}`);
  console.log(`  sequences: ${summary.sequences}`);
  console.log(`  captions: ${summary.captions}`);
  console.log(`  transitions: ${summary.transitions}`);
}

function printWorkspaceInspect(filePath: string, snapshot: MotionWorkspaceSnapshot): void {
  const summary = summarizeComposition(snapshot.document);
  const revision = "globalRevision" in snapshot
    ? snapshot.globalRevision
    : snapshot.revision;

  console.log(`\n══ Motion Workspace Snapshot ══`);
  console.log(`  file: ${filePath}`);
  console.log(`  schemaVersion: ${snapshot.schemaVersion}`);
  console.log(`  revision: ${revision}`);
  console.log(`  savedAt: ${snapshot.savedAt}`);
  console.log(`  source: ${formatWorkspaceSource(snapshot)}`);
  console.log(`  editor.values: ${Object.keys(snapshot.editor.values).length}`);
  console.log(`  editor.selection: ${formatSelection(snapshot.editor.selection)}`);
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
  if (summary.targets !== undefined) {
    console.log(`  composition.targets: ${summary.targets}`);
  }
  if (summary.scenes !== undefined) {
    console.log(`  composition.scenes: ${summary.scenes}`);
  }
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
      printCompositionInspect(result.filePath, result.value as MotionCompositionDocument);
      return;
    }

    printWorkspaceInspect(result.filePath, result.value as MotionWorkspaceSnapshot);
  } catch (error) {
    console.error(`motion 문서 읽기 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}
