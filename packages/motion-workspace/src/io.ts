// @def.boundary motion-workspace-spec
import {
  createMotionCompositionDocument,
  createMotionCompositionDocumentV2,
  MOTION_COMPOSITION_SCHEMA_V2,
  validateMotionCompositionDocument,
  validateMotionCompositionDocumentV2,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
  type MotionCompositionDocumentV1,
  type MotionCompositionDocumentV2,
} from "motion-content";
import {
  MOTION_WORKSPACE_SCHEMA_V1,
  MOTION_WORKSPACE_SCHEMA_V2,
  type MotionWorkspaceCreateOptions,
  type MotionWorkspaceDocument,
  type MotionWorkspaceSceneRevisions,
  type MotionWorkspaceSnapshot,
  type MotionWorkspaceSnapshotV1,
  type MotionWorkspaceSnapshotV2,
} from "./types.js";

const MOTION_EDITOR_SELECTION_KINDS = [
  "composition",
  "layer",
  "sequence",
  "caption",
  "cue-preset",
  "transition",
  "target",
  "scene",
  "scene-layer",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isMotionCompositionV2(
  composition: MotionCompositionDef | MotionCompositionDefV2,
): composition is MotionCompositionDefV2 {
  return "targets" in composition && "scenes" in composition;
}

function getWorkspaceSceneIds(document: MotionWorkspaceDocument): readonly string[] {
  return document.schemaVersion === MOTION_COMPOSITION_SCHEMA_V2
    ? document.composition.scenes.map((scene) => scene.id)
    : [];
}

function createSceneRevisions(
  document: MotionWorkspaceDocument,
  seed: MotionWorkspaceSceneRevisions = {},
): MotionWorkspaceSceneRevisions {
  const revisions: Record<string, number> = {};
  for (const sceneId of getWorkspaceSceneIds(document)) {
    revisions[sceneId] = seed[sceneId] ?? 0;
  }
  return revisions;
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function formatPath(path: string, key: string): string {
  return `${path}.${key}`;
}

function pushMissingIssue(issues: string[], path: string, expected: string): void {
  issues.push(`${path}: 필수 ${expected} 필드가 없습니다.`);
}

function pushTypeIssue(issues: string[], path: string, expected: string, actual: unknown): void {
  issues.push(`${path}: ${expected}여야 하지만 ${describeValue(actual)}입니다.`);
}

function pushEnumIssue(
  issues: string[],
  path: string,
  expected: readonly string[],
  actual: unknown,
): void {
  issues.push(`${path}: ${expected.join(" | ")} 중 하나여야 하지만 ${JSON.stringify(actual)}입니다.`);
}

function prefixNestedIssue(prefix: string, issue: string): string {
  return issue.replace(/^\$/, prefix);
}

function requireRecord(value: unknown, path: string, issues: string[]): value is Record<string, unknown> {
  if (!isRecord(value)) {
    pushTypeIssue(issues, path, "object", value);
    return false;
  }
  return true;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): string | null {
  if (!hasOwn(record, key)) {
    pushMissingIssue(issues, formatPath(path, key), "string");
    return null;
  }
  const value = record[key];
  if (!isString(value)) {
    pushTypeIssue(issues, formatPath(path, key), "string", value);
    return null;
  }
  return value;
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): number | null {
  if (!hasOwn(record, key)) {
    pushMissingIssue(issues, formatPath(path, key), "number");
    return null;
  }
  const value = record[key];
  if (!isFiniteNumber(value)) {
    pushTypeIssue(issues, formatPath(path, key), "number", value);
    return null;
  }
  return value;
}

function requireBoolean(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): boolean | null {
  if (!hasOwn(record, key)) {
    pushMissingIssue(issues, formatPath(path, key), "boolean");
    return null;
  }
  const value = record[key];
  if (typeof value !== "boolean") {
    pushTypeIssue(issues, formatPath(path, key), "boolean", value);
    return null;
  }
  return value;
}

function validateMotionWorkspaceSelection(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (value === null) {
    return;
  }
  if (!requireRecord(value, path, issues)) {
    return;
  }

  const kind = requireString(value, "kind", path, issues);
  if (kind !== null && !MOTION_EDITOR_SELECTION_KINDS.includes(kind as (typeof MOTION_EDITOR_SELECTION_KINDS)[number])) {
    pushEnumIssue(issues, `${path}.kind`, MOTION_EDITOR_SELECTION_KINDS, kind);
  }
  if (kind === "scene-layer") {
    requireString(value, "sceneId", path, issues);
    requireString(value, "targetId", path, issues);
    return;
  }
  requireString(value, "id", path, issues);
}

function validateMotionParameterValues(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (!requireRecord(value, path, issues)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!isString(entry) && !isFiniteNumber(entry)) {
      pushTypeIssue(issues, `${path}.${key}`, "string 또는 number", entry);
    }
  }
}

function validateMotionWorkspaceViewport(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (!requireRecord(value, path, issues)) {
    return;
  }

  requireNumber(value, "zoom", path, issues);
  requireNumber(value, "scrollLeftMs", path, issues);
  requireNumber(value, "visibleDurationMs", path, issues);
}

function validateMotionWorkspaceEditorState(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (!requireRecord(value, path, issues)) {
    return;
  }

  if (!hasOwn(value, "values")) {
    pushMissingIssue(issues, `${path}.values`, "object");
  } else {
    validateMotionParameterValues(value["values"], `${path}.values`, issues);
  }

  if (!hasOwn(value, "selection")) {
    pushMissingIssue(issues, `${path}.selection`, "object 또는 null");
  } else {
    validateMotionWorkspaceSelection(value["selection"], `${path}.selection`, issues);
  }

  if (!hasOwn(value, "viewport")) {
    pushMissingIssue(issues, `${path}.viewport`, "object");
  } else {
    validateMotionWorkspaceViewport(value["viewport"], `${path}.viewport`, issues);
  }

  requireBoolean(value, "loop", path, issues);
  requireNumber(value, "playbackRate", path, issues);
}

function validateMotionWorkspaceSource(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (value === undefined) {
    return;
  }
  if (!requireRecord(value, path, issues)) {
    return;
  }

  if (hasOwn(value, "presetId") && value["presetId"] !== null && value["presetId"] !== undefined && !isString(value["presetId"])) {
    pushTypeIssue(issues, `${path}.presetId`, "string 또는 null", value["presetId"]);
  }
  if (hasOwn(value, "storageKey") && value["storageKey"] !== undefined && !isString(value["storageKey"])) {
    pushTypeIssue(issues, `${path}.storageKey`, "string", value["storageKey"]);
  }
  if (hasOwn(value, "path") && value["path"] !== undefined && !isString(value["path"])) {
    pushTypeIssue(issues, `${path}.path`, "string", value["path"]);
  }
}

function validateMotionWorkspaceDocument(
  value: unknown,
  path: string,
  issues: string[],
): MotionWorkspaceDocument | null {
  if (!isRecord(value)) {
    pushTypeIssue(issues, path, "object", value);
    return null;
  }

  const documentIssues = value["schemaVersion"] === MOTION_COMPOSITION_SCHEMA_V2
    ? validateMotionCompositionDocumentV2(value)
    : validateMotionCompositionDocument(value);
  issues.push(...documentIssues.map((issue) => prefixNestedIssue(path, issue)));
  return documentIssues.length === 0 ? value as unknown as MotionWorkspaceDocument : null;
}

function validateMotionWorkspaceSceneRevisions(
  value: unknown,
  document: MotionWorkspaceDocument | null,
  path: string,
  issues: string[],
): void {
  if (!requireRecord(value, path, issues)) {
    return;
  }

  for (const [sceneId, revision] of Object.entries(value)) {
    if (!isFiniteNumber(revision)) {
      pushTypeIssue(issues, `${path}.${sceneId}`, "number", revision);
    }
  }

  if (!document) {
    return;
  }

  const sceneIds = new Set(getWorkspaceSceneIds(document));
  for (const sceneId of sceneIds) {
    if (!hasOwn(value, sceneId)) {
      pushMissingIssue(issues, `${path}.${sceneId}`, "number");
    }
  }

  for (const sceneId of Object.keys(value)) {
    if (!sceneIds.has(sceneId)) {
      issues.push(`${path}.${sceneId}: document.scenes에 없는 sceneId입니다.`);
    }
  }
}

function validateMotionWorkspaceSnapshotV1AtPath(
  value: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  const schemaVersion = requireString(value, "schemaVersion", path, issues);
  if (schemaVersion !== null && schemaVersion !== MOTION_WORKSPACE_SCHEMA_V1) {
    issues.push(
      `${path}.schemaVersion: ${MOTION_WORKSPACE_SCHEMA_V1}여야 하지만 ${JSON.stringify(schemaVersion)}입니다.`,
    );
  }

  if (!hasOwn(value, "document")) {
    pushMissingIssue(issues, `${path}.document`, "object");
  } else {
    validateMotionWorkspaceDocument(value["document"], `${path}.document`, issues);
  }

  if (!hasOwn(value, "editor")) {
    pushMissingIssue(issues, `${path}.editor`, "object");
  } else {
    validateMotionWorkspaceEditorState(value["editor"], `${path}.editor`, issues);
  }

  requireNumber(value, "revision", path, issues);
  requireString(value, "savedAt", path, issues);
  validateMotionWorkspaceSource(value["source"], `${path}.source`, issues);
}

function validateMotionWorkspaceSnapshotV2AtPath(
  value: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  const schemaVersion = requireString(value, "schemaVersion", path, issues);
  if (schemaVersion !== null && schemaVersion !== MOTION_WORKSPACE_SCHEMA_V2) {
    issues.push(
      `${path}.schemaVersion: ${MOTION_WORKSPACE_SCHEMA_V2}여야 하지만 ${JSON.stringify(schemaVersion)}입니다.`,
    );
  }

  let document: MotionWorkspaceDocument | null = null;
  if (!hasOwn(value, "document")) {
    pushMissingIssue(issues, `${path}.document`, "object");
  } else {
    document = validateMotionWorkspaceDocument(value["document"], `${path}.document`, issues);
  }

  if (!hasOwn(value, "editor")) {
    pushMissingIssue(issues, `${path}.editor`, "object");
  } else {
    validateMotionWorkspaceEditorState(value["editor"], `${path}.editor`, issues);
  }

  requireNumber(value, "globalRevision", path, issues);
  if (!hasOwn(value, "sceneRevisions")) {
    pushMissingIssue(issues, `${path}.sceneRevisions`, "object");
  } else {
    validateMotionWorkspaceSceneRevisions(
      value["sceneRevisions"],
      document,
      `${path}.sceneRevisions`,
      issues,
    );
  }
  requireString(value, "savedAt", path, issues);
  validateMotionWorkspaceSource(value["source"], `${path}.source`, issues);
}

function validateMotionWorkspaceSnapshotAtPath(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (!requireRecord(value, path, issues)) {
    return;
  }

  const schemaVersion = value["schemaVersion"];
  if (schemaVersion === MOTION_WORKSPACE_SCHEMA_V1) {
    validateMotionWorkspaceSnapshotV1AtPath(value, path, issues);
    return;
  }
  if (schemaVersion === MOTION_WORKSPACE_SCHEMA_V2) {
    validateMotionWorkspaceSnapshotV2AtPath(value, path, issues);
    return;
  }

  if (!hasOwn(value, "schemaVersion")) {
    pushMissingIssue(issues, `${path}.schemaVersion`, `string (${MOTION_WORKSPACE_SCHEMA_V1} | ${MOTION_WORKSPACE_SCHEMA_V2})`);
    return;
  }

  pushEnumIssue(
    issues,
    `${path}.schemaVersion`,
    [MOTION_WORKSPACE_SCHEMA_V1, MOTION_WORKSPACE_SCHEMA_V2],
    schemaVersion,
  );
}

function assertWorkspaceShape(value: unknown): asserts value is MotionWorkspaceSnapshot {
  const issues = validateMotionWorkspaceSnapshot(value);
  if (issues.length > 0) {
    throw new MotionWorkspaceParseError(issues);
  }
}

export class MotionWorkspaceParseError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.length === 1 ? issues[0] : `MotionWorkspace JSON 검증 실패\n- ${issues.join("\n- ")}`);
    this.name = "MotionWorkspaceParseError";
    this.issues = issues;
  }
}

function createPersistedEditorState(
  options: MotionWorkspaceCreateOptions,
): MotionWorkspaceSnapshotV1["editor"] {
  const values = Object.fromEntries(
    options.composition.parameters.map((parameter) => [parameter.id, parameter.defaultValue]),
  ) as Record<string, string | number>;

  for (const [key, value] of Object.entries(options.values ?? {})) {
    if (value !== undefined) {
      values[key] = value;
    }
  }

  return {
    values,
    selection: null,
    viewport: {
      zoom: 1,
      scrollLeftMs: 0,
      visibleDurationMs: Math.min(4000, options.composition.durationMs),
    },
    loop: false,
    playbackRate: 1,
  };
}

export function createMotionWorkspaceSnapshotV1(
  options: MotionWorkspaceCreateOptions,
): MotionWorkspaceSnapshotV1 {
  const document = isMotionCompositionV2(options.composition)
    ? createMotionCompositionDocumentV2(options.composition)
    : createMotionCompositionDocument(options.composition);

  return {
    schemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
    document,
    editor: createPersistedEditorState(options),
    revision: 0,
    savedAt: options.savedAt ?? new Date().toISOString(),
    source: options.source,
  };
}

export function createMotionWorkspaceSnapshotV2(
  options: MotionWorkspaceCreateOptions,
): MotionWorkspaceSnapshotV2 {
  const document = isMotionCompositionV2(options.composition)
    ? createMotionCompositionDocumentV2(options.composition)
    : createMotionCompositionDocument(options.composition);

  return {
    schemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
    document,
    editor: createPersistedEditorState(options),
    globalRevision: 0,
    sceneRevisions: createSceneRevisions(document),
    savedAt: options.savedAt ?? new Date().toISOString(),
    source: options.source,
  };
}

export function createMotionWorkspaceSnapshot(
  options: MotionWorkspaceCreateOptions,
): MotionWorkspaceSnapshotV2 {
  return createMotionWorkspaceSnapshotV2(options);
}

export function createMotionWorkspaceDocument(
  composition:
    | MotionCompositionDef
    | MotionCompositionDefV2
    | MotionCompositionDocumentV1
    | MotionCompositionDocumentV2,
): MotionWorkspaceSnapshotV2 {
  const document = "schemaVersion" in composition
    ? composition
    : isMotionCompositionV2(composition)
      ? createMotionCompositionDocumentV2(composition)
      : createMotionCompositionDocument(composition);
  return createMotionWorkspaceSnapshot({
    composition: document.composition,
  });
}

export function validateMotionWorkspaceSnapshot(
  value: unknown,
): readonly string[] {
  const issues: string[] = [];
  validateMotionWorkspaceSnapshotAtPath(value, "$", issues);
  return issues;
}

export function isMotionWorkspaceSnapshotV1(value: unknown): value is MotionWorkspaceSnapshotV1 {
  return isRecord(value) && value["schemaVersion"] === MOTION_WORKSPACE_SCHEMA_V1 && validateMotionWorkspaceSnapshot(value).length === 0;
}

export function isMotionWorkspaceSnapshotV2(value: unknown): value is MotionWorkspaceSnapshotV2 {
  return isRecord(value) && value["schemaVersion"] === MOTION_WORKSPACE_SCHEMA_V2 && validateMotionWorkspaceSnapshot(value).length === 0;
}

export function serializeMotionWorkspaceSnapshot(
  snapshot: MotionWorkspaceSnapshot,
): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseMotionWorkspaceSnapshot(
  json: string,
): MotionWorkspaceSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MotionWorkspaceParseError([`$: JSON 파싱에 실패했습니다. ${reason}`]);
  }
  assertWorkspaceShape(parsed);
  return parsed;
}
