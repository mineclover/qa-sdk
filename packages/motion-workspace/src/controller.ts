// @def.boundary motion-workspace-spec
import {
  applyMotionEditorSessionCommand,
  canRedoMotionEditorSession,
  canUndoMotionEditorSession,
  createMotionCompositionDocument,
  createMotionCompositionDocumentV2,
  createMotionEditorSession,
  createMotionEditorState,
  isMotionEditorSessionDirty,
  previewMotionEditorSessionCommand,
  redoMotionEditorSession,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
  type MotionCompositionDocumentV1,
  type MotionCompositionDocumentV2,
  type MotionCompositionSchema,
  type MotionEditorCommand,
  type MotionEditorSelectionV2,
  type MotionEditorSession,
  type MotionEditorState,
  type MotionParameterValues,
  type MotionSceneDef,
  type ResolvedMotionCompositionSchema,
  undoMotionEditorSession,
} from 'motion-content';
import { createMotionWorkspaceSnapshot } from './io.js';
import { migrateMotionWorkspaceSnapshot } from './migrate.js';
import type {
  MotionWorkspaceControllerSnapshot,
  MotionWorkspaceCreateOptions,
  MotionWorkspaceSnapshot,
  MotionWorkspaceSnapshotV1,
  MotionWorkspaceSnapshotV2,
} from './types.js';

export interface MotionWorkspaceControllerSaveOptions {
  readonly savedAt?: string;
}

export type MotionWorkspaceControllerInput =
  | string
  | MotionWorkspaceSnapshot
  | MotionWorkspaceSnapshotV1
  | Record<string, unknown>;

type WorkspaceDocument = MotionCompositionDocumentV1 | MotionCompositionDocumentV2;

type WorkspaceSession = MotionEditorSession<ResolvedMotionCompositionSchema>;
type WorkspaceState = MotionEditorState<ResolvedMotionCompositionSchema>;

const SCENE_SESSION_COMMAND_TYPES = new Set<MotionEditorCommand['type']>([
  'rename-scene',
  'update-scene-timing',
  'add-scene-placement',
  'remove-scene-placement',
  'update-scene-placement-timing',
  'update-scene-placement-cue',
]);

const SESSION_LOCAL_COMMAND_TYPES = new Set<MotionEditorCommand['type']>([
  'select',
  'play',
  'pause',
  'restart',
  'set-current-time',
  'set-loop',
  'set-playback-rate',
]);

function isSceneComposition(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
): composition is MotionCompositionDefV2 {
  return 'targets' in composition && 'scenes' in composition;
}

function toEditableComposition(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
): MotionCompositionSchema {
  const { values: _resolvedValues, ...nextComposition } =
    composition as ResolvedMotionCompositionSchema & {
      readonly values?: MotionParameterValues;
    };
  return nextComposition as MotionCompositionSchema;
}

function toWorkspaceDocument(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
): WorkspaceDocument {
  const editableComposition = toEditableComposition(composition);
  return isSceneComposition(editableComposition)
    ? createMotionCompositionDocumentV2(editableComposition)
    : createMotionCompositionDocument(editableComposition as MotionCompositionDef);
}

function replaceSceneInComposition(
  composition: MotionCompositionDefV2,
  scene: MotionSceneDef,
): MotionCompositionDefV2 {
  let changed = false;
  const scenes = composition.scenes.map((entry) => {
    if (entry.id !== scene.id) {
      return entry;
    }
    changed = true;
    return scene;
  });

  return changed ? { ...composition, scenes } : composition;
}

function findSceneInComposition(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  sceneId: string,
): MotionSceneDef | undefined {
  if (!isSceneComposition(composition)) {
    return undefined;
  }

  return (toEditableComposition(composition) as MotionCompositionDefV2).scenes.find(
    (scene) => scene.id === sceneId,
  );
}

function resolveSelectedSceneId(selection: MotionEditorSelectionV2 | null): string | null {
  if (!selection) {
    return null;
  }
  if (selection.kind === 'scene') {
    return selection.id;
  }
  if (selection.kind === 'scene-layer') {
    return selection.sceneId;
  }
  return null;
}

function createStateFromTemplate(
  composition: MotionCompositionSchema,
  values: Partial<MotionParameterValues>,
  template: WorkspaceState,
): WorkspaceState {
  const resolved = createMotionEditorState(composition, values);

  return {
    ...resolved,
    selection: template.selection,
    viewport: template.viewport,
    transport: {
      ...template.transport,
      durationMs: resolved.transport.durationMs,
      currentTimeMs: Math.min(template.transport.currentTimeMs, resolved.transport.durationMs),
    },
    activeSequenceIds: template.activeSequenceIds,
    activeLayerIds: template.activeLayerIds,
    activeCaptionId: template.activeCaptionId,
  };
}

function createWorkspaceExport(
  session: WorkspaceSession,
  workspace: MotionWorkspaceSnapshotV2,
): MotionWorkspaceSnapshotV2 {
  return {
    ...workspace,
    document: toWorkspaceDocument(session.present.composition),
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

function createSessionFromWorkspace(workspace: MotionWorkspaceSnapshotV2): WorkspaceSession {
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
  candidate: MotionWorkspaceSnapshotV2,
  workspace: MotionWorkspaceSnapshotV2,
): boolean {
  return (
    JSON.stringify([candidate.document, candidate.editor, candidate.source ?? null]) !==
    JSON.stringify([workspace.document, workspace.editor, workspace.source ?? null])
  );
}

function diffSceneRevisions(
  previous: MotionCompositionSchema,
  next: MotionCompositionSchema,
  currentSceneRevisions: MotionWorkspaceSnapshotV2['sceneRevisions'],
): Pick<MotionWorkspaceSnapshotV2, 'globalRevision' | 'sceneRevisions'> {
  if (!isSceneComposition(previous) || !isSceneComposition(next)) {
    const documentChanged = JSON.stringify(previous) !== JSON.stringify(next);
    return {
      globalRevision: documentChanged ? 1 : 0,
      sceneRevisions: {},
    };
  }

  const previousScenes = new Map(previous.scenes.map((scene) => [scene.id, scene]));
  const nextScenes = new Map(next.scenes.map((scene) => [scene.id, scene]));
  const previousSceneIds = new Set(previousScenes.keys());
  const nextSceneIds = new Set(nextScenes.keys());
  const structureChanged =
    previousSceneIds.size !== nextSceneIds.size ||
    [...previousSceneIds].some((sceneId) => !nextSceneIds.has(sceneId)) ||
    [...nextSceneIds].some((sceneId) => !previousSceneIds.has(sceneId));

  const sceneRevisions: Record<string, number> = {};
  for (const scene of next.scenes) {
    const previousScene = previousScenes.get(scene.id);
    const previousRevision = currentSceneRevisions[scene.id] ?? 0;
    sceneRevisions[scene.id] =
      previousScene && JSON.stringify(previousScene) !== JSON.stringify(scene)
        ? previousRevision + 1
        : previousRevision;
  }

  return {
    globalRevision: structureChanged ? 1 : 0,
    sceneRevisions,
  };
}

function buildSnapshot(
  session: WorkspaceSession,
  workspace: MotionWorkspaceSnapshotV2,
): MotionWorkspaceControllerSnapshot {
  return {
    workspace: createWorkspaceExport(session, workspace),
    dirty: isMotionEditorSessionDirty(session),
    checkpointCount: session.past.length,
  };
}

export interface MotionWorkspaceController {
  getSession(): WorkspaceSession;
  getState(): WorkspaceState;
  getSnapshot(): MotionWorkspaceControllerSnapshot;
  isDirty(): boolean;
  getRevision(): number;
  getCheckpointCount(): number;
  preview(command: MotionEditorCommand): WorkspaceState;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): MotionWorkspaceControllerSnapshot;
  redo(): MotionWorkspaceControllerSnapshot;
  loadWorkspace(snapshot: MotionWorkspaceControllerInput): MotionWorkspaceControllerSnapshot;
  replaceWorkspace(snapshot: MotionWorkspaceControllerInput): MotionWorkspaceControllerSnapshot;
  loadDocument(document: WorkspaceDocument): MotionWorkspaceControllerSnapshot;
  saveWorkspace(options?: MotionWorkspaceControllerSaveOptions): MotionWorkspaceControllerSnapshot;
  exportWorkspace(): MotionWorkspaceSnapshotV2;
  apply(command: MotionEditorCommand): MotionWorkspaceControllerSnapshot;
  exportDocument(): WorkspaceDocument;
}

export function createMotionWorkspaceController(
  options: MotionWorkspaceCreateOptions,
): MotionWorkspaceController {
  let workspace = createMotionWorkspaceSnapshot(options);
  let globalSession = createSessionFromWorkspace(workspace);
  let sceneSessions = new Map<string, WorkspaceSession>();
  let activeSceneId = resolveSelectedSceneId(globalSession.present.selection);

  function resetWorkspace(nextWorkspace: MotionWorkspaceSnapshotV2): void {
    workspace = nextWorkspace;
    globalSession = createSessionFromWorkspace(workspace);
    sceneSessions = new Map();
    activeSceneId = resolveSelectedSceneId(globalSession.present.selection);
  }

  function getCurrentTemplateState(): WorkspaceState {
    if (activeSceneId) {
      const sceneSession = sceneSessions.get(activeSceneId);
      if (sceneSession) {
        return sceneSession.present;
      }
    }
    return globalSession.present;
  }

  function composeGlobalSceneState(excludedSceneId?: string): MotionCompositionDefV2 | null {
    if (!isSceneComposition(globalSession.present.composition)) {
      return null;
    }

    let composition = toEditableComposition(
      globalSession.present.composition,
    ) as MotionCompositionDefV2;
    for (const [sceneId, session] of sceneSessions) {
      if (sceneId === excludedSceneId) {
        continue;
      }
      const scene = findSceneInComposition(session.present.composition, sceneId);
      if (!scene) {
        continue;
      }
      composition = replaceSceneInComposition(composition, scene);
    }
    return composition;
  }

  function buildEffectiveGlobalState(state: WorkspaceState): WorkspaceState {
    if (!isSceneComposition(state.composition) || sceneSessions.size === 0) {
      return state;
    }

    let composition = toEditableComposition(state.composition) as MotionCompositionDefV2;
    for (const [sceneId, session] of sceneSessions) {
      const scene = findSceneInComposition(session.present.composition, sceneId);
      if (!scene) {
        continue;
      }
      composition = replaceSceneInComposition(composition, scene);
    }

    return createStateFromTemplate(composition, state.values, state);
  }

  function getEffectiveGlobalSession(): WorkspaceSession {
    if (!isSceneComposition(globalSession.present.composition) || sceneSessions.size === 0) {
      return globalSession;
    }

    return {
      past: globalSession.past.map((state) => buildEffectiveGlobalState(state as WorkspaceState)),
      present: buildEffectiveGlobalState(globalSession.present),
      future: globalSession.future.map((state) =>
        buildEffectiveGlobalState(state as WorkspaceState),
      ),
    };
  }

  function buildEffectiveSceneState(
    state: WorkspaceState,
    sceneId: string,
    baseComposition: MotionCompositionDefV2,
  ): WorkspaceState {
    const scene = findSceneInComposition(state.composition, sceneId);
    if (!scene) {
      return createStateFromTemplate(baseComposition, globalSession.present.values, state);
    }
    return createStateFromTemplate(
      replaceSceneInComposition(baseComposition, scene),
      globalSession.present.values,
      state,
    );
  }

  function createSceneSession(sceneId: string, persist: boolean): WorkspaceSession | null {
    const composition = composeGlobalSceneState();
    if (!composition || !composition.scenes.some((scene) => scene.id === sceneId)) {
      return null;
    }

    const session: WorkspaceSession = {
      past: [],
      present: createStateFromTemplate(
        composition,
        globalSession.present.values,
        getCurrentTemplateState(),
      ),
      future: [],
    };

    if (persist) {
      sceneSessions.set(sceneId, session);
    }

    return session;
  }

  function rebaseSceneSession(sceneId: string, session: WorkspaceSession): WorkspaceSession | null {
    const baseComposition = composeGlobalSceneState(sceneId);
    if (!baseComposition || !baseComposition.scenes.some((scene) => scene.id === sceneId)) {
      sceneSessions.delete(sceneId);
      if (activeSceneId === sceneId) {
        activeSceneId = null;
      }
      return null;
    }

    const nextSession: WorkspaceSession = {
      past: session.past.map((state) =>
        buildEffectiveSceneState(state as WorkspaceState, sceneId, baseComposition),
      ),
      present: buildEffectiveSceneState(session.present, sceneId, baseComposition),
      future: session.future.map((state) =>
        buildEffectiveSceneState(state as WorkspaceState, sceneId, baseComposition),
      ),
    };

    sceneSessions.set(sceneId, nextSession);
    return nextSession;
  }

  function getSceneSession(sceneId: string): WorkspaceSession | null {
    const existing = sceneSessions.get(sceneId);
    if (existing) {
      return rebaseSceneSession(sceneId, existing);
    }
    return createSceneSession(sceneId, true);
  }

  function collapseSceneSessionsIntoGlobal(): void {
    if (sceneSessions.size === 0) {
      return;
    }

    globalSession = getEffectiveGlobalSession();
    sceneSessions = new Map();
    activeSceneId = resolveSelectedSceneId(globalSession.present.selection);
  }

  function getCurrentSession(): WorkspaceSession {
    if (!activeSceneId) {
      return getEffectiveGlobalSession();
    }

    const sceneSession = getSceneSession(activeSceneId);
    if (!sceneSession) {
      activeSceneId = null;
      return getEffectiveGlobalSession();
    }
    return sceneSession;
  }

  function setSceneSession(sceneId: string, session: WorkspaceSession): WorkspaceSession {
    sceneSessions.set(sceneId, session);
    activeSceneId = sceneId;
    return session;
  }

  function syncActiveSceneAfterGlobalCommand(): void {
    const selectedSceneId = resolveSelectedSceneId(globalSession.present.selection);
    if (selectedSceneId) {
      activeSceneId = selectedSceneId;
      return;
    }
    if (activeSceneId && getSceneSession(activeSceneId)) {
      return;
    }
    activeSceneId = null;
  }

  function applySceneScopedCommand(command: MotionEditorCommand): WorkspaceSession | null {
    if (!('sceneId' in command)) {
      return null;
    }

    const sceneSession = getSceneSession(command.sceneId);
    if (!sceneSession) {
      return null;
    }

    return setSceneSession(command.sceneId, applyMotionEditorSessionCommand(sceneSession, command));
  }

  function applySessionLocalCommand(command: MotionEditorCommand): WorkspaceSession {
    if (command.type === 'select') {
      const selectedSceneId = resolveSelectedSceneId(command.selection);
      if (selectedSceneId) {
        const targetSession =
          getSceneSession(selectedSceneId) ?? createSceneSession(selectedSceneId, true);
        if (targetSession) {
          return setSceneSession(
            selectedSceneId,
            applyMotionEditorSessionCommand(targetSession, command),
          );
        }
      }
    }

    if (activeSceneId) {
      const sceneSession = getSceneSession(activeSceneId);
      if (sceneSession) {
        return setSceneSession(
          activeSceneId,
          applyMotionEditorSessionCommand(sceneSession, command),
        );
      }
      activeSceneId = null;
    }

    globalSession = applyMotionEditorSessionCommand(globalSession, command);
    syncActiveSceneAfterGlobalCommand();
    return getCurrentSession();
  }

  function applyGlobalCommand(command: MotionEditorCommand): WorkspaceSession {
    if (
      command.type === 'set-composition' ||
      command.type === 'add-scene' ||
      command.type === 'remove-scene'
    ) {
      collapseSceneSessionsIntoGlobal();
      globalSession = applyMotionEditorSessionCommand(globalSession, command);
      if (
        command.type === 'set-composition' ||
        command.type === 'add-scene' ||
        command.type === 'remove-scene'
      ) {
        sceneSessions = new Map();
      }
      syncActiveSceneAfterGlobalCommand();
      return getCurrentSession();
    }

    globalSession = applyMotionEditorSessionCommand(globalSession, command);
    syncActiveSceneAfterGlobalCommand();
    return getCurrentSession();
  }

  function saveCurrentWorkspace(
    saveOptions: MotionWorkspaceControllerSaveOptions = {},
  ): MotionWorkspaceControllerSnapshot {
    const currentSession = getCurrentSession();
    const candidate = createWorkspaceExport(currentSession, workspace);
    if (!hasPersistedWorkspaceChanges(candidate, workspace)) {
      return buildSnapshot(currentSession, workspace);
    }

    const revisionDelta = diffSceneRevisions(
      workspace.document.composition,
      candidate.document.composition,
      workspace.sceneRevisions,
    );
    const usesLegacyRevision =
      !isSceneComposition(workspace.document.composition) &&
      !isSceneComposition(candidate.document.composition);

    workspace = {
      ...candidate,
      globalRevision:
        workspace.globalRevision + (usesLegacyRevision ? 1 : revisionDelta.globalRevision),
      sceneRevisions: revisionDelta.sceneRevisions,
      savedAt: saveOptions.savedAt ?? new Date().toISOString(),
    };

    const freshPresent = createSessionFromWorkspace(workspace).present;
    globalSession = {
      ...globalSession,
      present: freshPresent,
    };

    return buildSnapshot(getCurrentSession(), workspace);
  }

  return {
    getSession() {
      return getCurrentSession();
    },
    getState() {
      return getCurrentSession().present;
    },
    getSnapshot() {
      return buildSnapshot(getCurrentSession(), workspace);
    },
    isDirty() {
      return isMotionEditorSessionDirty(getCurrentSession());
    },
    getRevision() {
      return workspace.globalRevision;
    },
    getCheckpointCount() {
      return getCurrentSession().past.length;
    },
    preview(command) {
      if (!isSceneComposition(globalSession.present.composition)) {
        return previewMotionEditorSessionCommand(globalSession, command);
      }

      if (SCENE_SESSION_COMMAND_TYPES.has(command.type)) {
        const sceneSession =
          'sceneId' in command
            ? (getSceneSession(command.sceneId) ?? createSceneSession(command.sceneId, false))
            : null;
        if (sceneSession) {
          return previewMotionEditorSessionCommand(sceneSession, command);
        }
      }

      if (SESSION_LOCAL_COMMAND_TYPES.has(command.type)) {
        if (command.type === 'select') {
          const selectedSceneId = resolveSelectedSceneId(command.selection);
          if (selectedSceneId) {
            const sceneSession =
              getSceneSession(selectedSceneId) ?? createSceneSession(selectedSceneId, false);
            if (sceneSession) {
              return previewMotionEditorSessionCommand(sceneSession, command);
            }
          }
        }
        return previewMotionEditorSessionCommand(getCurrentSession(), command);
      }

      return previewMotionEditorSessionCommand(getEffectiveGlobalSession(), command);
    },
    canUndo() {
      return canUndoMotionEditorSession(getCurrentSession());
    },
    canRedo() {
      return canRedoMotionEditorSession(getCurrentSession());
    },
    undo() {
      if (activeSceneId) {
        const sceneSession = getSceneSession(activeSceneId);
        if (sceneSession) {
          sceneSessions.set(activeSceneId, undoMotionEditorSession(sceneSession));
        } else {
          activeSceneId = null;
        }
      } else {
        globalSession = undoMotionEditorSession(globalSession);
      }
      return buildSnapshot(getCurrentSession(), workspace);
    },
    redo() {
      if (activeSceneId) {
        const sceneSession = getSceneSession(activeSceneId);
        if (sceneSession) {
          sceneSessions.set(activeSceneId, redoMotionEditorSession(sceneSession));
        } else {
          activeSceneId = null;
        }
      } else {
        globalSession = redoMotionEditorSession(globalSession);
      }
      return buildSnapshot(getCurrentSession(), workspace);
    },
    loadWorkspace(snapshot) {
      resetWorkspace(migrateMotionWorkspaceSnapshot(snapshot));
      return buildSnapshot(getCurrentSession(), workspace);
    },
    replaceWorkspace(snapshot) {
      return this.loadWorkspace(snapshot);
    },
    loadDocument(document) {
      resetWorkspace(
        createMotionWorkspaceSnapshot({
          composition: document.composition,
          values: workspace.editor.values,
          source: workspace.source,
        }),
      );
      return buildSnapshot(getCurrentSession(), workspace);
    },
    saveWorkspace(saveOptions = {}) {
      return saveCurrentWorkspace(saveOptions);
    },
    exportWorkspace() {
      return createWorkspaceExport(getCurrentSession(), workspace);
    },
    apply(command) {
      if (!isSceneComposition(globalSession.present.composition)) {
        globalSession = applyMotionEditorSessionCommand(globalSession, command);
        return buildSnapshot(globalSession, workspace);
      }

      if (SCENE_SESSION_COMMAND_TYPES.has(command.type)) {
        const sceneSession = applySceneScopedCommand(command);
        return buildSnapshot(sceneSession ?? getCurrentSession(), workspace);
      }

      if (SESSION_LOCAL_COMMAND_TYPES.has(command.type)) {
        return buildSnapshot(applySessionLocalCommand(command), workspace);
      }

      return buildSnapshot(applyGlobalCommand(command), workspace);
    },
    exportDocument() {
      return toWorkspaceDocument(getCurrentSession().present.composition);
    },
  };
}
