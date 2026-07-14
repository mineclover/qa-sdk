// @def.boundary motion-workspace-service-spec
import {
  createMotionWorkspaceController as createRuntimeWorkspaceController,
  migrateMotionWorkspaceSnapshot,
  type MotionWorkspaceController as RuntimeMotionWorkspaceController,
  type MotionWorkspaceDescriptor,
  type MotionWorkspaceSnapshotV2,
} from 'motion-workspace';
import type { MotionSceneDef } from 'motion-content';
import { createInvalidRequestError, type MotionWorkspaceServiceHealthResponse } from './errors.js';
import {
  createMotionWorkspaceNotFoundError,
  createMotionWorkspaceSceneNotFoundError,
  type MotionWorkspaceRepository,
} from './repository.js';
import { createMotionWorkspaceServiceInfo } from './service-info.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

const MOTION_EDITOR_COMMAND_TYPES = [
  'select',
  'set-composition',
  'set-parameter',
  'set-current-time',
  'set-loop',
  'set-playback-rate',
  'play',
  'pause',
  'restart',
  'add-layer',
  'remove-layer',
  'add-sequence',
  'remove-sequence',
  'add-caption',
  'remove-caption',
  'add-transition',
  'remove-transition',
  'update-item-string',
  'update-item-timing',
  'update-sequence-stagger',
  'update-sequence-layer-slot',
  'update-sequence-layer-role',
  'update-layer-cue-kind',
  'update-layer-cue-preset',
  'update-layer-content-type',
  'update-transition-style',
  'update-transition-duration',
  'update-transition-param',
] as const;

type MotionWorkspaceApplyCommand = Parameters<RuntimeMotionWorkspaceController['apply']>[0];

type SceneWorkspaceSnapshot = MotionWorkspaceSnapshotV2 & {
  readonly document: MotionWorkspaceSnapshotV2['document'] & {
    readonly schemaVersion: 'qa-sdk.motion-composition/v2';
    readonly composition: MotionWorkspaceSnapshotV2['document']['composition'] & {
      readonly scenes: readonly MotionSceneDef[];
    };
  };
};

function parseWorkspaceRequest(input: unknown): MotionWorkspaceSnapshotV2 {
  if (!isRecord(input)) {
    throw createInvalidRequestError('요청 본문은 { workspace } object여야 합니다.');
  }

  if (!hasOwn(input, 'workspace')) {
    throw createInvalidRequestError('workspace 필드가 필요합니다.');
  }

  return migrateMotionWorkspaceSnapshot(
    input['workspace'] as string | MotionWorkspaceSnapshotV2 | Record<string, unknown>,
  );
}

function parseRevision(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw createInvalidRequestError(`${fieldName} 필드는 0 이상인 정수여야 합니다.`);
  }

  return Number(value);
}

function readSceneArrayField<T>(
  input: Record<string, unknown>,
  key: 'layers' | 'sequences' | 'captions',
): readonly T[] {
  if (!hasOwn(input, key)) {
    return [];
  }

  const value = input[key];
  if (!Array.isArray(value)) {
    throw createInvalidRequestError(`scene.${key} 필드는 array여야 합니다.`);
  }

  return value as readonly T[];
}

function parseSceneValue(input: unknown): MotionSceneDef {
  if (!isRecord(input)) {
    throw createInvalidRequestError('scene 필드는 object여야 합니다.');
  }

  if (typeof input['id'] !== 'string' || input['id'].trim().length === 0) {
    throw createInvalidRequestError('scene.id 필드는 비어 있지 않은 string이어야 합니다.');
  }

  if (typeof input['title'] !== 'string' || input['title'].trim().length === 0) {
    throw createInvalidRequestError('scene.title 필드는 비어 있지 않은 string이어야 합니다.');
  }

  if (
    typeof input['startMs'] !== 'number' ||
    !Number.isFinite(input['startMs']) ||
    input['startMs'] < 0
  ) {
    throw createInvalidRequestError('scene.startMs 필드는 0 이상 number여야 합니다.');
  }

  if (
    typeof input['durationMs'] !== 'number' ||
    !Number.isFinite(input['durationMs']) ||
    input['durationMs'] <= 0
  ) {
    throw createInvalidRequestError('scene.durationMs 필드는 0보다 큰 number여야 합니다.');
  }

  return {
    id: input['id'],
    title: input['title'],
    startMs: input['startMs'],
    durationMs: input['durationMs'],
    layers: readSceneArrayField<MotionSceneDef['layers'][number]>(input, 'layers'),
    sequences: readSceneArrayField<MotionSceneDef['sequences'][number]>(input, 'sequences'),
    captions: readSceneArrayField<MotionSceneDef['captions'][number]>(input, 'captions'),
  };
}

function parseSceneMutationRequest(input: unknown): {
  readonly revision: number;
  readonly scene: MotionSceneDef;
} {
  if (!isRecord(input)) {
    throw createInvalidRequestError('요청 본문은 { revision, scene } object여야 합니다.');
  }

  if (!hasOwn(input, 'revision')) {
    throw createInvalidRequestError('revision 필드가 필요합니다.');
  }

  if (!hasOwn(input, 'scene')) {
    throw createInvalidRequestError('scene 필드가 필요합니다.');
  }

  return {
    revision: parseRevision(input['revision'], 'revision'),
    scene: parseSceneValue(input['scene']),
  };
}

function parseSceneStructureRequest(input: unknown): {
  readonly revision: number;
} {
  if (!isRecord(input)) {
    throw createInvalidRequestError('요청 본문은 { revision } object여야 합니다.');
  }

  if (!hasOwn(input, 'revision')) {
    throw createInvalidRequestError('revision 필드가 필요합니다.');
  }

  return {
    revision: parseRevision(input['revision'], 'revision'),
  };
}

function parseApplyCommandRequest(input: unknown): {
  readonly revision: number;
  readonly command: MotionWorkspaceApplyCommand;
} {
  if (!isRecord(input)) {
    throw createInvalidRequestError('요청 본문은 { revision, command } object여야 합니다.');
  }

  if (!hasOwn(input, 'revision')) {
    throw createInvalidRequestError('revision 필드가 필요합니다.');
  }

  if (!Number.isInteger(input['revision']) || Number(input['revision']) < 0) {
    throw createInvalidRequestError('apply-command 요청은 revision이 0 이상인 정수여야 합니다.');
  }

  if (!hasOwn(input, 'command')) {
    throw createInvalidRequestError('command 필드가 필요합니다.');
  }

  const command = input['command'];
  if (!isRecord(command)) {
    throw createInvalidRequestError('command 필드는 object여야 합니다.');
  }

  if (typeof command['type'] !== 'string') {
    throw createInvalidRequestError('command.type 필드는 string이어야 합니다.');
  }

  if (
    !MOTION_EDITOR_COMMAND_TYPES.includes(
      command['type'] as (typeof MOTION_EDITOR_COMMAND_TYPES)[number],
    )
  ) {
    throw createInvalidRequestError(
      `지원되지 않는 command.type입니다: ${JSON.stringify(command['type'])}.`,
    );
  }

  return {
    revision: Number(input['revision']),
    command: command as MotionWorkspaceApplyCommand,
  };
}

function deriveExpectedRevision(workspace: MotionWorkspaceSnapshotV2): number {
  if (!Number.isInteger(workspace.globalRevision) || workspace.globalRevision < 1) {
    throw createInvalidRequestError(
      'workspace update 요청은 globalRevision이 1 이상인 snapshot이어야 합니다.',
    );
  }

  return workspace.globalRevision - 1;
}

function isSceneWorkspace(
  workspace: MotionWorkspaceSnapshotV2,
): workspace is SceneWorkspaceSnapshot {
  return workspace.document.schemaVersion === 'qa-sdk.motion-composition/v2';
}

function requireSceneWorkspace(workspace: MotionWorkspaceSnapshotV2): SceneWorkspaceSnapshot {
  if (!isSceneWorkspace(workspace)) {
    throw createInvalidRequestError(
      'scene endpoint는 qa-sdk.motion-composition/v2 workspace에서만 지원합니다.',
    );
  }

  return workspace;
}

function toSceneSummary(sceneWorkspace: SceneWorkspaceSnapshot) {
  return sceneWorkspace.document.composition.scenes.map((scene) => ({
    scene,
    revision: sceneWorkspace.sceneRevisions[scene.id] ?? 0,
  }));
}

function getSceneOrThrow(
  workspaceId: string,
  sceneWorkspace: SceneWorkspaceSnapshot,
  sceneId: string,
): MotionSceneDef {
  const scene = sceneWorkspace.document.composition.scenes.find((entry) => entry.id === sceneId);
  if (!scene) {
    throw createMotionWorkspaceSceneNotFoundError(workspaceId, sceneId);
  }

  return scene;
}

export interface MotionWorkspaceControllerDeps {
  readonly repository: MotionWorkspaceRepository;
  readonly getUptimeSeconds?: () => number;
  readonly getNow?: () => string;
  readonly version?: string;
}

export interface MotionWorkspaceController {
  health(): MotionWorkspaceServiceHealthResponse;
  listWorkspaces(): Promise<{
    readonly workspaces: readonly MotionWorkspaceDescriptor[];
  }>;
  getWorkspace(id: string): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV2;
  }>;
  listScenes(id: string): Promise<{
    readonly scenes: readonly {
      readonly scene: MotionSceneDef;
      readonly revision: number;
    }[];
    readonly globalRevision: number;
  }>;
  getScene(
    id: string,
    sceneId: string,
  ): Promise<{
    readonly scene: MotionSceneDef;
    readonly revision: number;
    readonly globalRevision: number;
  }>;
  updateScene(
    id: string,
    sceneId: string,
    input: unknown,
  ): Promise<{
    readonly scene: MotionSceneDef;
    readonly revision: number;
    readonly globalRevision: number;
  }>;
  createScene(
    id: string,
    input: unknown,
  ): Promise<{
    readonly scene: MotionSceneDef;
    readonly revision: number;
    readonly globalRevision: number;
  }>;
  deleteScene(
    id: string,
    sceneId: string,
    input: unknown,
  ): Promise<{
    readonly deletedSceneId: string;
    readonly globalRevision: number;
  }>;
  createWorkspace(
    id: string,
    input: unknown,
  ): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV2;
  }>;
  updateWorkspace(
    id: string,
    input: unknown,
  ): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV2;
  }>;
  applyCommand(
    id: string,
    input: unknown,
  ): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV2;
  }>;
  deleteWorkspace(id: string): Promise<void>;
}

function createCommandController(
  workspace: MotionWorkspaceSnapshotV2,
): RuntimeMotionWorkspaceController {
  const controller = createRuntimeWorkspaceController({
    composition: workspace.document.composition,
    values: workspace.editor.values,
    source: workspace.source,
    savedAt: workspace.savedAt,
  });

  controller.loadWorkspace(workspace);
  return controller;
}

export function createMotionWorkspaceController(
  deps: MotionWorkspaceControllerDeps,
): MotionWorkspaceController {
  async function loadSceneWorkspace(id: string): Promise<SceneWorkspaceSnapshot> {
    const workspace = await deps.repository.get(id);
    if (!workspace) {
      throw createMotionWorkspaceNotFoundError(id);
    }

    return requireSceneWorkspace(workspace);
  }

  return {
    health() {
      const info = createMotionWorkspaceServiceInfo();
      return {
        status: 'ok',
        service: info.serviceId,
        default_persistence: info.defaultPersistence,
        uptime_seconds: deps.getUptimeSeconds?.(),
        version: deps.version,
      };
    },
    async listWorkspaces() {
      return {
        workspaces: await deps.repository.list(),
      };
    },
    async getWorkspace(id) {
      const workspace = await deps.repository.get(id);
      if (!workspace) {
        throw createMotionWorkspaceNotFoundError(id);
      }

      return { workspace };
    },
    async listScenes(id) {
      const workspace = await loadSceneWorkspace(id);
      return {
        scenes: toSceneSummary(workspace),
        globalRevision: workspace.globalRevision,
      };
    },
    async getScene(id, sceneId) {
      const workspace = await loadSceneWorkspace(id);
      const scene = getSceneOrThrow(id, workspace, sceneId);
      return {
        scene,
        revision: workspace.sceneRevisions[sceneId] ?? 0,
        globalRevision: workspace.globalRevision,
      };
    },
    async updateScene(id, sceneId, input) {
      const request = parseSceneMutationRequest(input);
      if (request.scene.id !== sceneId) {
        throw createInvalidRequestError(
          `scene.id와 path sceneId가 일치해야 합니다: ${request.scene.id} !== ${sceneId}.`,
        );
      }
      await loadSceneWorkspace(id);
      const workspace = await deps.repository.saveScene(
        id,
        sceneId,
        request.scene,
        request.revision,
      );
      const sceneWorkspace = requireSceneWorkspace(workspace);
      const scene = getSceneOrThrow(id, sceneWorkspace, sceneId);
      return {
        scene,
        revision: sceneWorkspace.sceneRevisions[sceneId] ?? 0,
        globalRevision: sceneWorkspace.globalRevision,
      };
    },
    async createScene(id, input) {
      const request = parseSceneMutationRequest(input);
      const workspace = await loadSceneWorkspace(id);

      if (workspace.document.composition.scenes.some((scene) => scene.id === request.scene.id)) {
        throw createInvalidRequestError(`scene가 이미 존재합니다: ${id}/${request.scene.id}.`);
      }

      const controller = createCommandController(workspace);
      controller.apply({
        type: 'add-scene',
        id: request.scene.id,
        title: request.scene.title,
        startMs: request.scene.startMs,
        durationMs: request.scene.durationMs,
        layers: request.scene.layers,
        sequences: request.scene.sequences,
        captions: request.scene.captions,
      });

      const savedWorkspace = controller.saveWorkspace({
        savedAt: deps.getNow?.(),
      }).workspace;
      const persistedWorkspace = await deps.repository.save({
        id,
        workspace: savedWorkspace,
        expectedRevision: request.revision,
      });
      const sceneWorkspace = requireSceneWorkspace(persistedWorkspace);
      const scene = getSceneOrThrow(id, sceneWorkspace, request.scene.id);
      return {
        scene,
        revision: sceneWorkspace.sceneRevisions[scene.id] ?? 0,
        globalRevision: sceneWorkspace.globalRevision,
      };
    },
    async deleteScene(id, sceneId, input) {
      const request = parseSceneStructureRequest(input);
      const workspace = await loadSceneWorkspace(id);
      getSceneOrThrow(id, workspace, sceneId);

      const controller = createCommandController(workspace);
      controller.apply({
        type: 'remove-scene',
        sceneId,
      });

      const savedWorkspace = controller.saveWorkspace({
        savedAt: deps.getNow?.(),
      }).workspace;
      const persistedWorkspace = await deps.repository.save({
        id,
        workspace: savedWorkspace,
        expectedRevision: request.revision,
      });
      return {
        deletedSceneId: sceneId,
        globalRevision: persistedWorkspace.globalRevision,
      };
    },
    async createWorkspace(id, input) {
      const workspace = parseWorkspaceRequest(input);
      return {
        workspace: await deps.repository.create({
          id,
          workspace,
        }),
      };
    },
    async updateWorkspace(id, input) {
      const workspace = parseWorkspaceRequest(input);
      return {
        workspace: await deps.repository.save({
          id,
          workspace,
          expectedRevision: deriveExpectedRevision(workspace),
        }),
      };
    },
    async applyCommand(id, input) {
      const request = parseApplyCommandRequest(input);
      const workspace = await deps.repository.get(id);
      if (!workspace) {
        throw createMotionWorkspaceNotFoundError(id);
      }

      const controller = createCommandController(workspace);
      controller.apply(request.command);

      return {
        workspace: await deps.repository.save({
          id,
          workspace: controller.saveWorkspace({
            savedAt: deps.getNow?.(),
          }).workspace,
          expectedRevision: request.revision,
        }),
      };
    },
    async deleteWorkspace(id) {
      const deleted = await deps.repository.delete(id);
      if (!deleted) {
        throw createMotionWorkspaceNotFoundError(id);
      }
    },
  };
}
