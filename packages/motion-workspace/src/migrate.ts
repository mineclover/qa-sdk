// @def.boundary motion-workspace-spec
import {
  MOTION_COMPOSITION_SCHEMA_V2,
  createMotionCompositionDocumentV2,
  migrateCompositionV1toV2,
  parseMotionComposition,
  type MotionCompositionDocumentV2,
  type MotionEditorSelectionV2,
} from "motion-content";
import {
  createMotionWorkspaceSnapshot,
  createMotionWorkspaceSnapshotV2,
  MotionWorkspaceParseError,
  validateMotionWorkspaceSnapshot,
} from "./io.js";
import {
  MOTION_WORKSPACE_SCHEMA_V1,
  MOTION_WORKSPACE_SCHEMA_V2,
  type MotionWorkspaceSourceMetadataV1,
  type MotionWorkspaceSnapshot,
  type MotionWorkspaceSnapshotV1,
  type MotionWorkspaceSnapshotV2,
} from "./types.js";

export const LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY = "qa-sdk.motion-content-editor-demo/v1";

export interface LegacyMotionEditorDemoStateV1 {
  readonly presetId: string | null;
  readonly document: string;
  readonly savedAt: string;
}

export interface MotionWorkspaceMigrateOptions {
  readonly expectedRevision?: number;
}

export interface MotionWorkspaceConflictErrorShape {
  readonly code: "revision_conflict";
  readonly message: string;
  readonly expectedRevision?: number;
  readonly actualRevision?: number;
}

export interface MotionWorkspaceUnknownSchemaVersionErrorShape {
  readonly code: "unknown_schema_version";
  readonly message: string;
  readonly schemaVersion?: string;
}

export type MotionWorkspaceMigrationErrorShape =
  | MotionWorkspaceConflictErrorShape
  | MotionWorkspaceUnknownSchemaVersionErrorShape;

export interface MotionWorkspaceMigrationResult {
  readonly workspace: MotionWorkspaceSnapshotV2;
  readonly migrated: boolean;
  readonly fromSchemaVersion: string;
  readonly toSchemaVersion: typeof MOTION_WORKSPACE_SCHEMA_V2;
}

export class MotionWorkspaceMigrationError extends Error {
  readonly shape: MotionWorkspaceMigrationErrorShape;

  constructor(shape: MotionWorkspaceMigrationErrorShape) {
    super(shape.message);
    this.name = "MotionWorkspaceMigrationError";
    this.shape = shape;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function parseMigrationInput(
  input: string | MotionWorkspaceSnapshot | LegacyMotionEditorDemoStateV1 | Record<string, unknown>,
): unknown {
  if (typeof input !== "string") {
    return input;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MotionWorkspaceParseError([`$: JSON 파싱에 실패했습니다. ${reason}`]);
  }
}

function readSchemaVersion(value: unknown): string | null {
  if (!isRecord(value) || !hasOwn(value, "schemaVersion")) {
    return null;
  }
  return typeof value["schemaVersion"] === "string"
    ? value["schemaVersion"]
    : null;
}

function createUnknownSchemaVersionError(schemaVersion: string | null): MotionWorkspaceMigrationError {
  return new MotionWorkspaceMigrationError({
    code: "unknown_schema_version",
    message: `지원되지 않는 workspace schemaVersion입니다: ${JSON.stringify(schemaVersion)}.`,
    schemaVersion: schemaVersion ?? undefined,
  });
}

function createRevisionConflictError(
  expectedRevision: number,
  actualRevision: number,
): MotionWorkspaceMigrationError {
  return new MotionWorkspaceMigrationError({
    code: "revision_conflict",
    message: `workspace revision이 충돌했습니다. expectedRevision=${expectedRevision}, actualRevision=${actualRevision}.`,
    expectedRevision,
    actualRevision,
  });
}

function getSceneIdsFromDocument(
  document: MotionWorkspaceSnapshotV2["document"] | MotionWorkspaceSnapshotV1["document"],
): readonly string[] {
  return document.schemaVersion === MOTION_COMPOSITION_SCHEMA_V2
    ? document.composition.scenes.map((scene) => scene.id)
    : [];
}

function readCompatLayerId(
  value: unknown,
): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)["layerId"];
  return typeof candidate === "string" ? candidate : undefined;
}

function migrateWorkspaceSelection(
  selection: MotionEditorSelectionV2 | null,
  document: MotionWorkspaceSnapshot["document"],
): MotionEditorSelectionV2 | null {
  if (!selection) {
    return null;
  }

  if (document.schemaVersion !== MOTION_COMPOSITION_SCHEMA_V2 || selection.kind !== "layer") {
    return selection;
  }

  for (const scene of document.composition.scenes) {
    const placement = scene.layers.find((layer) =>
      layer.targetId === selection.id || readCompatLayerId(layer) === selection.id
    );
    if (placement) {
      return {
        kind: "scene-layer",
        sceneId: scene.id,
        targetId: placement.targetId,
      };
    }
  }

  return selection;
}

function migrateWorkspaceDocument(
  document: MotionWorkspaceSnapshot["document"],
): MotionCompositionDocumentV2 {
  if (document.schemaVersion === MOTION_COMPOSITION_SCHEMA_V2) {
    return document;
  }

  return createMotionCompositionDocumentV2(
    migrateCompositionV1toV2(document.composition),
  );
}

function createSceneRevisions(
  workspace: MotionWorkspaceSnapshot,
  document: MotionCompositionDocumentV2,
): MotionWorkspaceSnapshotV2["sceneRevisions"] {
  const sceneIds = getSceneIdsFromDocument(document);
  const defaultRevision = getWorkspaceBaseRevision(workspace);

  if (
    workspace.schemaVersion === MOTION_WORKSPACE_SCHEMA_V2
    && workspace.document.schemaVersion === MOTION_COMPOSITION_SCHEMA_V2
  ) {
    return Object.fromEntries(
      sceneIds.map((sceneId) => [sceneId, workspace.sceneRevisions[sceneId] ?? defaultRevision]),
    );
  }

  return Object.fromEntries(
    sceneIds.map((sceneId) => [sceneId, defaultRevision]),
  );
}

function migrateWorkspaceV1ToV2(
  workspace: MotionWorkspaceSnapshotV1,
): MotionWorkspaceSnapshotV2 {
  const document = migrateWorkspaceDocument(workspace.document);
  const migrated = createMotionWorkspaceSnapshotV2({
    composition: document.composition,
    values: workspace.editor.values,
    source: workspace.source,
    savedAt: workspace.savedAt,
  });

  return {
    ...migrated,
    document,
    editor: {
      ...workspace.editor,
      selection: migrateWorkspaceSelection(workspace.editor.selection, document),
    },
    globalRevision: workspace.revision,
    sceneRevisions: createSceneRevisions(workspace, document),
  };
}

function normalizeWorkspaceV2(
  workspace: MotionWorkspaceSnapshotV2,
): MotionWorkspaceSnapshotV2 {
  const document = migrateWorkspaceDocument(workspace.document);

  return {
    ...workspace,
    document,
    editor: {
      ...workspace.editor,
      selection: migrateWorkspaceSelection(workspace.editor.selection, document),
    },
    sceneRevisions: createSceneRevisions(workspace, document),
  };
}

function getWorkspaceBaseRevision(workspace: MotionWorkspaceSnapshot): number {
  return workspace.schemaVersion === MOTION_WORKSPACE_SCHEMA_V2
    ? workspace.globalRevision
    : workspace.revision;
}

function validateLegacyMotionEditorDemoState(value: unknown): readonly string[] {
  const issues: string[] = [];

  if (!isRecord(value)) {
    issues.push(`$: object여야 하지만 ${describeValue(value)}입니다.`);
    return issues;
  }

  if (!hasOwn(value, "presetId")) {
    issues.push("$.presetId: 필수 string | null 필드가 없습니다.");
  } else if (value["presetId"] !== null && typeof value["presetId"] !== "string") {
    issues.push(`$.presetId: string | null이어야 하지만 ${describeValue(value["presetId"])}입니다.`);
  }

  if (!hasOwn(value, "document")) {
    issues.push("$.document: 필수 string 필드가 없습니다.");
  } else if (typeof value["document"] !== "string") {
    issues.push(`$.document: string여야 하지만 ${describeValue(value["document"])}입니다.`);
  }

  if (!hasOwn(value, "savedAt")) {
    issues.push("$.savedAt: 필수 string 필드가 없습니다.");
  } else if (typeof value["savedAt"] !== "string") {
    issues.push(`$.savedAt: string여야 하지만 ${describeValue(value["savedAt"])}입니다.`);
  }

  return issues;
}

function createLegacyMotionEditorSource(
  state: LegacyMotionEditorDemoStateV1,
): MotionWorkspaceSourceMetadataV1 {
  if (state.presetId) {
    return {
      presetId: state.presetId,
      storageKey: LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
    };
  }

  return {
    storageKey: LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
  };
}

export function parseLegacyMotionEditorDemoState(
  input: string | LegacyMotionEditorDemoStateV1 | Record<string, unknown>,
): LegacyMotionEditorDemoStateV1 {
  const candidate = parseMigrationInput(input);
  const issues = validateLegacyMotionEditorDemoState(candidate);

  if (issues.length > 0) {
    throw new MotionWorkspaceParseError(issues);
  }

  return candidate as LegacyMotionEditorDemoStateV1;
}

export function migrateLegacyMotionEditorDemoState(
  input: string | LegacyMotionEditorDemoStateV1 | Record<string, unknown>,
): MotionWorkspaceMigrationResult {
  const legacyState = parseLegacyMotionEditorDemoState(input);
  let composition: ReturnType<typeof parseMotionComposition>;

  try {
    composition = parseMotionComposition(legacyState.document);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MotionWorkspaceParseError([`$.document: legacy demo composition 파싱에 실패했습니다. ${reason}`]);
  }

  return {
    workspace: migrateMotionWorkspaceSnapshot(
      createMotionWorkspaceSnapshot({
        composition,
        source: createLegacyMotionEditorSource(legacyState),
        savedAt: legacyState.savedAt,
      }),
    ),
    migrated: true,
    fromSchemaVersion: LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
    toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
  };
}

export function migrateMotionWorkspace(
  input: string | MotionWorkspaceSnapshot | Record<string, unknown>,
  options: MotionWorkspaceMigrateOptions = {},
): MotionWorkspaceMigrationResult {
  const candidate = parseMigrationInput(input);
  const schemaVersion = readSchemaVersion(candidate);

  if (
    schemaVersion === null
    || (schemaVersion !== MOTION_WORKSPACE_SCHEMA_V1 && schemaVersion !== MOTION_WORKSPACE_SCHEMA_V2)
  ) {
    throw createUnknownSchemaVersionError(schemaVersion);
  }

  const issues = validateMotionWorkspaceSnapshot(candidate);
  if (issues.length > 0) {
    throw new MotionWorkspaceParseError(issues);
  }

  const workspace = candidate as MotionWorkspaceSnapshot;
  const actualRevision = getWorkspaceBaseRevision(workspace);
  if (
    options.expectedRevision !== undefined
    && actualRevision !== options.expectedRevision
  ) {
    throw createRevisionConflictError(options.expectedRevision, actualRevision);
  }

  const migratedWorkspace = workspace.schemaVersion === MOTION_WORKSPACE_SCHEMA_V2
    ? normalizeWorkspaceV2(workspace)
    : migrateWorkspaceV1ToV2(workspace);
  const migrated = workspace.schemaVersion !== MOTION_WORKSPACE_SCHEMA_V2
    || workspace.document.schemaVersion !== MOTION_COMPOSITION_SCHEMA_V2
    || migratedWorkspace.editor.selection !== workspace.editor.selection;

  return {
    workspace: migratedWorkspace,
    migrated,
    fromSchemaVersion: workspace.schemaVersion,
    toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
  };
}

export function migrateMotionWorkspaceSnapshot(
  input: string | MotionWorkspaceSnapshot | Record<string, unknown>,
  options: MotionWorkspaceMigrateOptions = {},
): MotionWorkspaceSnapshotV2 {
  return migrateMotionWorkspace(input, options).workspace;
}
