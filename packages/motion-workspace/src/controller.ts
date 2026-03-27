import {
  applyMotionEditorSessionCommand,
  canRedoMotionEditorSession,
  canUndoMotionEditorSession,
  createMotionCompositionDocument,
  createMotionEditorSession,
  isMotionEditorSessionDirty,
  previewMotionEditorSessionCommand,
  redoMotionEditorSession,
  type MotionCompositionDocumentV1,
  type MotionEditorCommand,
  type MotionEditorSession,
  type MotionEditorState,
  undoMotionEditorSession,
} from "motion-content";
import {
  createMotionWorkspaceSnapshot,
} from "./io.js";
import { migrateMotionWorkspaceSnapshot } from "./migrate.js";
import type {
  MotionWorkspaceControllerSnapshot,
  MotionWorkspaceCreateOptions,
  MotionWorkspaceSnapshotV1,
} from "./types.js";

export interface MotionWorkspaceControllerSaveOptions {
  readonly savedAt?: string;
}

export type MotionWorkspaceControllerInput =
  | string
  | MotionWorkspaceSnapshotV1
  | Record<string, unknown>;

export interface MotionWorkspaceController {
  getSession(): MotionEditorSession;
  getState(): MotionEditorState;
  getSnapshot(): MotionWorkspaceControllerSnapshot;
  isDirty(): boolean;
  getRevision(): number;
  getCheckpointCount(): number;
  preview(command: MotionEditorCommand): MotionEditorState;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): MotionWorkspaceControllerSnapshot;
  redo(): MotionWorkspaceControllerSnapshot;
  loadWorkspace(snapshot: MotionWorkspaceControllerInput): MotionWorkspaceControllerSnapshot;
  replaceWorkspace(snapshot: MotionWorkspaceControllerInput): MotionWorkspaceControllerSnapshot;
  loadDocument(document: MotionCompositionDocumentV1): MotionWorkspaceControllerSnapshot;
  saveWorkspace(options?: MotionWorkspaceControllerSaveOptions): MotionWorkspaceControllerSnapshot;
  exportWorkspace(): MotionWorkspaceSnapshotV1;
  apply(command: MotionEditorCommand): MotionWorkspaceControllerSnapshot;
  exportDocument(): MotionCompositionDocumentV1;
}

function createWorkspaceExport(
  session: MotionEditorSession,
  workspace: MotionWorkspaceSnapshotV1,
): MotionWorkspaceSnapshotV1 {
  const { values: _resolvedValues, ...composition } = session.present.composition;

  return {
    ...workspace,
    document: createMotionCompositionDocument(composition),
    editor: {
      ...workspace.editor,
      values: session.present.values,
      selection: session.present.selection,
      viewport: session.present.viewport,
      loop: session.present.transport.loop,
      playbackRate: session.present.transport.playbackRate,
    },
  };
}

function createSessionFromWorkspace(
  workspace: MotionWorkspaceSnapshotV1,
): MotionEditorSession {
  const session = createMotionEditorSession(
    workspace.document.composition,
    workspace.editor.values,
  );

  return {
    ...session,
    present: {
      ...session.present,
      selection: workspace.editor.selection,
      viewport: workspace.editor.viewport,
      transport: {
        ...session.present.transport,
        loop: workspace.editor.loop,
        playbackRate: workspace.editor.playbackRate,
      },
    },
  };
}

function hasPersistedWorkspaceChanges(
  candidate: MotionWorkspaceSnapshotV1,
  workspace: MotionWorkspaceSnapshotV1,
): boolean {
  return JSON.stringify([
    candidate.document,
    candidate.editor,
    candidate.source ?? null,
  ]) !== JSON.stringify([
    workspace.document,
    workspace.editor,
    workspace.source ?? null,
  ]);
}

function buildSnapshot(
  session: MotionEditorSession,
  workspace: MotionWorkspaceSnapshotV1,
): MotionWorkspaceControllerSnapshot {
  return {
    workspace: createWorkspaceExport(session, workspace),
    dirty: isMotionEditorSessionDirty(session),
    checkpointCount: session.past.length,
  };
}

export function createMotionWorkspaceController(
  options: MotionWorkspaceCreateOptions,
): MotionWorkspaceController {
  let workspace = createMotionWorkspaceSnapshot(options);
  let session = createSessionFromWorkspace(workspace);

  return {
    getSession() {
      return session;
    },
    getState() {
      return session.present;
    },
    getSnapshot() {
      return buildSnapshot(session, workspace);
    },
    isDirty() {
      return isMotionEditorSessionDirty(session);
    },
    getRevision() {
      return workspace.revision;
    },
    getCheckpointCount() {
      return session.past.length;
    },
    preview(command) {
      return previewMotionEditorSessionCommand(session, command);
    },
    canUndo() {
      return canUndoMotionEditorSession(session);
    },
    canRedo() {
      return canRedoMotionEditorSession(session);
    },
    undo() {
      session = undoMotionEditorSession(session);
      return buildSnapshot(session, workspace);
    },
    redo() {
      session = redoMotionEditorSession(session);
      return buildSnapshot(session, workspace);
    },
    loadWorkspace(snapshot) {
      workspace = migrateMotionWorkspaceSnapshot(snapshot);
      session = createSessionFromWorkspace(workspace);
      return buildSnapshot(session, workspace);
    },
    replaceWorkspace(snapshot) {
      return this.loadWorkspace(snapshot);
    },
    loadDocument(document) {
      workspace = createMotionWorkspaceSnapshot({
        composition: document.composition,
        values: workspace.editor.values,
        source: workspace.source,
      });
      session = createSessionFromWorkspace(workspace);
      return buildSnapshot(session, workspace);
    },
    saveWorkspace(saveOptions = {}) {
      const candidate = createWorkspaceExport(session, workspace);
      if (!hasPersistedWorkspaceChanges(candidate, workspace)) {
        return buildSnapshot(session, workspace);
      }

      workspace = {
        ...candidate,
        revision: workspace.revision + 1,
        savedAt: saveOptions.savedAt ?? new Date().toISOString(),
      };
      // present를 새 workspace 상태로 갱신하되 past/future(undo/redo 히스토리)는 보존
      const freshPresent = createSessionFromWorkspace(workspace).present;
      session = {
        ...session,
        present: freshPresent,
      };
      return buildSnapshot(session, workspace);
    },
    exportWorkspace() {
      return createWorkspaceExport(session, workspace);
    },
    apply(command) {
      session = applyMotionEditorSessionCommand(session, command);
      return buildSnapshot(session, workspace);
    },
    exportDocument() {
      const { values: _resolvedValues, ...composition } = session.present.composition;
      return createMotionCompositionDocument(composition);
    },
  };
}
