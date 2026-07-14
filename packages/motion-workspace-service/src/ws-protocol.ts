// @def.boundary motion-workspace-service-spec
export interface WorkspaceSceneLockInfo {
  readonly sceneId: string;
  readonly userId: string;
}

export interface WorkspacePresenceCursor {
  readonly x: number;
  readonly y: number;
}

export interface WorkspacePresenceInfo {
  readonly userId: string;
  readonly activeSceneId?: string;
  readonly cursor?: WorkspacePresenceCursor;
}

export type WorkspaceSceneUnlockReason = 'explicit' | 'disconnect' | 'timeout';

export interface WorkspaceWsConnectedMessage {
  readonly type: 'connected';
  readonly workspaceId: string;
  readonly userId: string;
  readonly sceneLocks: readonly WorkspaceSceneLockInfo[];
  readonly presences: readonly WorkspacePresenceInfo[];
}

export interface WorkspaceWsBroadcastMessage {
  readonly type: 'workspace-message';
  readonly workspaceId: string;
  readonly userId: string;
  readonly payload: unknown;
}

export interface WorkspaceSceneLockMessage extends WorkspaceSceneLockInfo {
  readonly type: 'scene:lock';
  readonly workspaceId: string;
  readonly holders: readonly string[];
  readonly warning: boolean;
}

export interface WorkspaceSceneUnlockMessage extends WorkspaceSceneLockInfo {
  readonly type: 'scene:unlock';
  readonly workspaceId: string;
  readonly holders: readonly string[];
  readonly reason: WorkspaceSceneUnlockReason;
}

export interface WorkspacePresenceMessage extends WorkspacePresenceInfo {
  readonly type: 'presence';
  readonly workspaceId: string;
}

export interface WorkspaceSceneUpdatedMessage {
  readonly type: 'scene:updated';
  readonly workspaceId: string;
  readonly sceneId: string;
  readonly revision: number;
}

export interface WorkspaceResourceUpdatedMessage {
  readonly type: 'resource:updated';
  readonly workspaceId: string;
  readonly revision: number;
}

export interface WorkspaceWsErrorMessage {
  readonly type: 'error';
  readonly code: string;
  readonly message: string;
}

export type WorkspaceWsServerMessage =
  | WorkspaceWsBroadcastMessage
  | WorkspaceWsConnectedMessage
  | WorkspaceSceneLockMessage
  | WorkspaceSceneUnlockMessage
  | WorkspacePresenceMessage
  | WorkspaceSceneUpdatedMessage
  | WorkspaceResourceUpdatedMessage
  | WorkspaceWsErrorMessage;

export type WorkspaceWsSceneControlMessage =
  | Pick<WorkspaceSceneLockMessage, 'type' | 'sceneId' | 'userId'>
  | Pick<WorkspaceSceneUnlockMessage, 'type' | 'sceneId' | 'userId'>;

export type WorkspaceWsPresenceInputMessage = Pick<
  WorkspacePresenceMessage,
  'type' | 'userId' | 'activeSceneId' | 'cursor'
>;

export type ParseWorkspaceWsSceneControlMessageResult =
  | WorkspaceWsSceneControlMessage
  | 'invalid'
  | null;

export type ParseWorkspaceWsPresenceMessageResult =
  | WorkspaceWsPresenceInputMessage
  | 'invalid'
  | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseOptionalNonEmptyString(value: unknown): string | undefined | 'invalid' {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'invalid';
  }

  return value.trim();
}

export function parseWorkspaceWsSceneControlMessage(
  value: unknown,
): ParseWorkspaceWsSceneControlMessageResult {
  if (!isRecord(value)) {
    return null;
  }

  const type = value['type'];
  if (type !== 'scene:lock' && type !== 'scene:unlock') {
    return null;
  }

  const sceneId = value['sceneId'];
  const userId = value['userId'];
  if (
    typeof sceneId !== 'string' ||
    sceneId.trim().length === 0 ||
    typeof userId !== 'string' ||
    userId.trim().length === 0
  ) {
    return 'invalid';
  }

  return {
    type,
    sceneId: sceneId.trim(),
    userId: userId.trim(),
  };
}

export function parseWorkspaceWsPresenceMessage(
  value: unknown,
): ParseWorkspaceWsPresenceMessageResult {
  if (!isRecord(value)) {
    return null;
  }

  if (value['type'] !== 'presence') {
    return null;
  }

  const userId = value['userId'];
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return 'invalid';
  }

  const activeSceneId = parseOptionalNonEmptyString(value['activeSceneId']);
  if (activeSceneId === 'invalid') {
    return 'invalid';
  }

  let cursor: WorkspacePresenceCursor | undefined;
  if (value['cursor'] !== undefined) {
    if (!isRecord(value['cursor'])) {
      return 'invalid';
    }

    const x = value['cursor']['x'];
    const y = value['cursor']['y'];
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      return 'invalid';
    }

    cursor = { x, y };
  }

  return {
    type: 'presence',
    userId: userId.trim(),
    ...(activeSceneId ? { activeSceneId } : {}),
    ...(cursor ? { cursor } : {}),
  };
}
