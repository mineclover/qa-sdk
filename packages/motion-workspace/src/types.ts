// @def.boundary motion-workspace-spec
import {
  MOTION_COMPOSITION_SCHEMA_V1,
} from "motion-content";
import type {
  MotionCompositionDef,
  MotionCompositionDefV2,
  MotionCompositionDocumentV1,
  MotionCompositionDocumentV2,
  MotionEditorSelectionV2,
  MotionEditorViewport,
  MotionParameterValues,
} from "motion-content";

export const MOTION_WORKSPACE_SCHEMA_V1 = "qa-sdk.motion-workspace/v1";
export const MOTION_WORKSPACE_SCHEMA_V2 = "qa-sdk.motion-workspace/v2";
export const MOTION_WORKSPACE_PERSISTED_EDITOR_FIELDS_V1 = [
  "values",
  "selection",
  "viewport",
  "loop",
  "playbackRate",
] as const;
export const MOTION_WORKSPACE_LOCAL_PREFERENCE_KEYS = ["layout", "theme"] as const;

export type MotionWorkspacePersistedEditorField =
  (typeof MOTION_WORKSPACE_PERSISTED_EDITOR_FIELDS_V1)[number];
export type MotionWorkspaceLocalPreferenceKey =
  (typeof MOTION_WORKSPACE_LOCAL_PREFERENCE_KEYS)[number];

/**
 * Optional provenance for how a workspace document was seeded or restored.
 * This metadata belongs to the online workspace layer, not the portable
 * composition document envelope.
 */
export interface MotionWorkspaceSourceMetadataV1 {
  readonly presetId?: string | null;
  readonly storageKey?: string;
  readonly path?: string;
}

export interface MotionWorkspaceSource extends MotionWorkspaceSourceMetadataV1 {}

/**
 * Persisted editor state that must round-trip across runtimes. Local shell
 * preferences such as dock layout and theme are intentionally excluded.
 */
export interface MotionWorkspacePersistedEditorStateV1 {
  readonly values: MotionParameterValues;
  readonly selection: MotionEditorSelectionV2 | null;
  readonly viewport: MotionEditorViewport;
  readonly loop: boolean;
  readonly playbackRate: number;
}

export interface MotionWorkspaceEditorState extends MotionWorkspacePersistedEditorStateV1 {}

/**
 * Shared contract describing which concerns live in the portable composition
 * envelope, the workspace snapshot, and local-only editor preferences.
 */
export interface MotionWorkspacePersistenceBoundaryV1 {
  readonly documentSchemaVersion: typeof MOTION_COMPOSITION_SCHEMA_V1;
  readonly workspaceSchemaVersion: typeof MOTION_WORKSPACE_SCHEMA_V1;
  readonly persistedEditorFields: readonly MotionWorkspacePersistedEditorField[];
  readonly localPreferenceKeys: readonly MotionWorkspaceLocalPreferenceKey[];
}

export const MOTION_WORKSPACE_PERSISTENCE_BOUNDARY_V1 = {
  documentSchemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
  workspaceSchemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
  persistedEditorFields: MOTION_WORKSPACE_PERSISTED_EDITOR_FIELDS_V1,
  localPreferenceKeys: MOTION_WORKSPACE_LOCAL_PREFERENCE_KEYS,
} satisfies MotionWorkspacePersistenceBoundaryV1;

export type MotionWorkspaceDocument =
  | MotionCompositionDocumentV1
  | MotionCompositionDocumentV2;

export type MotionWorkspaceComposition =
  | MotionCompositionDef
  | MotionCompositionDefV2;

export type MotionWorkspaceSceneRevisions = Readonly<Record<string, number>>;

/**
 * Online workspace state. The embedded composition document keeps the original
 * `qa-sdk.motion-composition/v1` envelope unchanged while revision/provenance
 * and persisted editor state are layered on top.
 */
export interface MotionWorkspaceSnapshotV1 {
  readonly schemaVersion: typeof MOTION_WORKSPACE_SCHEMA_V1;
  readonly document: MotionWorkspaceDocument;
  readonly editor: MotionWorkspacePersistedEditorStateV1;
  readonly revision: number;
  readonly savedAt: string;
  readonly source?: MotionWorkspaceSourceMetadataV1;
}

/**
 * Scene-aware workspace state for concurrent editing. `globalRevision` tracks
 * structural changes such as scene add/remove, while `sceneRevisions` tracks
 * content changes for each individual scene.
 */
export interface MotionWorkspaceSnapshotV2 {
  readonly schemaVersion: typeof MOTION_WORKSPACE_SCHEMA_V2;
  readonly document: MotionWorkspaceDocument;
  readonly editor: MotionWorkspacePersistedEditorStateV1;
  readonly globalRevision: number;
  readonly sceneRevisions: MotionWorkspaceSceneRevisions;
  readonly savedAt: string;
  readonly source?: MotionWorkspaceSourceMetadataV1;
}

export type MotionWorkspaceSnapshot =
  | MotionWorkspaceSnapshotV1
  | MotionWorkspaceSnapshotV2;

export interface MotionWorkspaceDescriptor {
  readonly id: string;
  readonly title: string;
  readonly revision: number;
  readonly savedAt: string;
}

export interface MotionWorkspaceStore {
  load(id: string): Promise<MotionWorkspaceSnapshot | null>;
  save(id: string, snapshot: MotionWorkspaceSnapshot): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<readonly MotionWorkspaceDescriptor[]>;
}

export interface MotionWorkspaceControllerSnapshot {
  readonly workspace: MotionWorkspaceSnapshotV2;
  readonly dirty: boolean;
  readonly checkpointCount: number;
}

export interface MotionWorkspaceCreateOptions {
  readonly composition: MotionWorkspaceComposition;
  readonly values?: Partial<MotionParameterValues>;
  readonly source?: MotionWorkspaceSourceMetadataV1;
  readonly savedAt?: string;
}
