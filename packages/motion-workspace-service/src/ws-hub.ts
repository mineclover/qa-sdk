import type {
  WorkspacePresenceInfo,
  WorkspacePresenceMessage,
  WorkspaceSceneLockInfo,
  WorkspaceSceneLockMessage,
  WorkspaceSceneUnlockMessage,
  WorkspaceSceneUnlockReason,
} from "./ws-protocol.js";

export interface WorkspaceWsPeerSocket {
  send(message: string): void;
}

export interface WorkspaceWsConnectionInfo {
  readonly connectionId: string;
  readonly workspaceId: string;
  readonly userId: string;
}

interface WorkspaceWsConnection extends WorkspaceWsConnectionInfo {
  readonly socket: WorkspaceWsPeerSocket;
  readonly lockedScenes: Set<string>;
}

interface WorkspacePresenceState extends WorkspacePresenceInfo {
  readonly workspaceId: string;
  readonly connectionIds: Set<string>;
}

interface WorkspaceSceneLockState extends WorkspaceSceneLockInfo {
  readonly workspaceId: string;
  readonly connectionIds: Set<string>;
  lastHeartbeatAt: number;
}

export interface WorkspaceWsHubOptions {
  readonly heartbeatTimeoutMs?: number;
  readonly getNow?: () => number;
}

export interface WorkspaceWsHub {
  connect(connection: {
    readonly workspaceId: string;
    readonly userId: string;
    readonly socket: WorkspaceWsPeerSocket;
  }): WorkspaceWsConnectionInfo;
  disconnect(connectionId: string): readonly WorkspaceSceneUnlockMessage[];
  broadcast(workspaceId: string, message: string): void;
  pruneExpiredSceneLocks(workspaceId: string): readonly WorkspaceSceneUnlockMessage[];
  updatePresence(input: {
    readonly connectionId: string;
    readonly activeSceneId?: string;
    readonly cursor?: WorkspacePresenceInfo["cursor"];
  }): WorkspacePresenceMessage | null;
  clearPresence(connectionId: string): WorkspacePresenceMessage | null;
  lockScene(input: {
    readonly connectionId: string;
    readonly sceneId: string;
  }): WorkspaceSceneLockMessage | null;
  unlockScene(input: {
    readonly connectionId: string;
    readonly sceneId: string;
    readonly reason?: WorkspaceSceneUnlockReason;
  }): WorkspaceSceneUnlockMessage | null;
  getPresence(workspaceId: string): readonly WorkspacePresenceInfo[];
  getSceneLocks(workspaceId: string): readonly WorkspaceSceneLockInfo[];
  getWorkspaceConnections(workspaceId: string): readonly WorkspaceWsConnectionInfo[];
  getWorkspaceConnectionCount(workspaceId: string): number;
}

export const DEFAULT_SCENE_LOCK_HEARTBEAT_TIMEOUT_MS = 10_000;

function sortUsers(userIds: Iterable<string>): string[] {
  return Array.from(userIds).sort((left, right) => left.localeCompare(right));
}

function toPresenceInfo(entry: WorkspacePresenceState): WorkspacePresenceInfo {
  return {
    userId: entry.userId,
    ...(entry.activeSceneId ? { activeSceneId: entry.activeSceneId } : {}),
    ...(entry.cursor ? { cursor: entry.cursor } : {}),
  };
}

export function createWorkspaceWsHub(
  options: WorkspaceWsHubOptions = {},
): WorkspaceWsHub {
  const connections = new Map<string, WorkspaceWsConnection>();
  const workspaceMembership = new Map<string, Set<string>>();
  const presence = new Map<string, Map<string, WorkspacePresenceState>>();
  const sceneLocks = new Map<
    string,
    Map<string, Map<string, WorkspaceSceneLockState>>
  >();
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ??
    DEFAULT_SCENE_LOCK_HEARTBEAT_TIMEOUT_MS;
  const getNow = options.getNow ?? Date.now;
  let nextConnectionSequence = 0;

  function getSceneLockUsers(
    workspaceId: string,
    sceneId: string,
  ): string[] {
    return sortUsers(sceneLocks.get(workspaceId)?.get(sceneId)?.keys() ?? []);
  }

  function deleteSceneLock(
    workspaceId: string,
    sceneId: string,
    userId: string,
  ): void {
    const workspaceSceneLocks = sceneLocks.get(workspaceId);
    const sceneUsers = workspaceSceneLocks?.get(sceneId);
    if (!sceneUsers) {
      return;
    }

    sceneUsers.delete(userId);
    if (sceneUsers.size === 0) {
      workspaceSceneLocks?.delete(sceneId);
    }
    if (workspaceSceneLocks && workspaceSceneLocks.size === 0) {
      sceneLocks.delete(workspaceId);
    }
  }

  function deletePresence(
    workspaceId: string,
    userId: string,
  ): void {
    const workspacePresence = presence.get(workspaceId);
    if (!workspacePresence) {
      return;
    }

    workspacePresence.delete(userId);
    if (workspacePresence.size === 0) {
      presence.delete(workspaceId);
    }
  }

  function releaseSceneLock(
    connectionId: string,
    sceneId: string,
    reason: WorkspaceSceneUnlockReason,
  ): WorkspaceSceneUnlockMessage | null {
    const connection = connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const sceneUsers = sceneLocks.get(connection.workspaceId)?.get(sceneId);
    const sceneLock = sceneUsers?.get(connection.userId);
    if (!sceneLock) {
      connection.lockedScenes.delete(sceneId);
      return null;
    }

    sceneLock.connectionIds.delete(connectionId);
    connection.lockedScenes.delete(sceneId);

    if (sceneLock.connectionIds.size > 0) {
      return null;
    }

    deleteSceneLock(connection.workspaceId, sceneId, connection.userId);
    return {
      type: "scene:unlock",
      workspaceId: connection.workspaceId,
      sceneId,
      userId: connection.userId,
      holders: getSceneLockUsers(connection.workspaceId, sceneId),
      reason,
    };
  }

  function clearPresence(connectionId: string): WorkspacePresenceMessage | null {
    const connection = connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const workspacePresence = presence.get(connection.workspaceId);
    const currentPresence = workspacePresence?.get(connection.userId);
    if (!currentPresence) {
      return null;
    }

    currentPresence.connectionIds.delete(connectionId);
    if (currentPresence.connectionIds.size > 0) {
      return null;
    }

    deletePresence(connection.workspaceId, connection.userId);
    return {
      type: "presence",
      workspaceId: connection.workspaceId,
      userId: connection.userId,
    };
  }

  function disconnect(connectionId: string): readonly WorkspaceSceneUnlockMessage[] {
    const connection = connections.get(connectionId);
    if (!connection) {
      return [];
    }

    const releasedLocks: WorkspaceSceneUnlockMessage[] = [];
    for (const sceneId of Array.from(connection.lockedScenes)) {
      const unlockMessage = releaseSceneLock(connectionId, sceneId, "disconnect");
      if (unlockMessage) {
        releasedLocks.push(unlockMessage);
      }
    }

    connections.delete(connectionId);

    const members = workspaceMembership.get(connection.workspaceId);
    if (members) {
      members.delete(connectionId);
      if (members.size === 0) {
        workspaceMembership.delete(connection.workspaceId);
      }
    }

    return releasedLocks;
  }

  return {
    connect(connection) {
      const connectionId = `workspace-ws-${++nextConnectionSequence}`;
      const storedConnection: WorkspaceWsConnection = {
        connectionId,
        workspaceId: connection.workspaceId,
        userId: connection.userId,
        socket: connection.socket,
        lockedScenes: new Set<string>(),
      };

      connections.set(connectionId, storedConnection);

      let members = workspaceMembership.get(connection.workspaceId);
      if (!members) {
        members = new Set<string>();
        workspaceMembership.set(connection.workspaceId, members);
      }
      members.add(connectionId);

      return {
        connectionId,
        workspaceId: connection.workspaceId,
        userId: connection.userId,
      };
    },

    disconnect,

    broadcast(workspaceId, message) {
      const members = workspaceMembership.get(workspaceId);
      if (!members) {
        return;
      }

      const staleConnectionIds: string[] = [];
      for (const connectionId of members) {
        const connection = connections.get(connectionId);
        if (!connection) {
          staleConnectionIds.push(connectionId);
          continue;
        }

        try {
          connection.socket.send(message);
        } catch {
          staleConnectionIds.push(connectionId);
        }
      }

      for (const connectionId of staleConnectionIds) {
        disconnect(connectionId);
      }
    },

    getWorkspaceConnections(workspaceId) {
      const members = workspaceMembership.get(workspaceId);
      if (!members) {
        return [];
      }

      const result: WorkspaceWsConnectionInfo[] = [];
      for (const connectionId of members) {
        const connection = connections.get(connectionId);
        if (!connection) {
          continue;
        }

        result.push({
          connectionId,
          workspaceId: connection.workspaceId,
          userId: connection.userId,
        });
      }

      return result;
    },

    updatePresence({ connectionId, activeSceneId, cursor }) {
      const connection = connections.get(connectionId);
      if (!connection) {
        return null;
      }

      let workspacePresence = presence.get(connection.workspaceId);
      if (!workspacePresence) {
        workspacePresence = new Map<string, WorkspacePresenceState>();
        presence.set(connection.workspaceId, workspacePresence);
      }

      const connectionIds = workspacePresence.get(connection.userId)?.connectionIds ??
        new Set<string>();
      connectionIds.add(connectionId);
      workspacePresence.set(connection.userId, {
        workspaceId: connection.workspaceId,
        userId: connection.userId,
        ...(activeSceneId ? { activeSceneId } : {}),
        ...(cursor ? { cursor } : {}),
        connectionIds,
      });

      return {
        type: "presence",
        workspaceId: connection.workspaceId,
        userId: connection.userId,
        ...(activeSceneId ? { activeSceneId } : {}),
        ...(cursor ? { cursor } : {}),
      };
    },

    clearPresence,

    pruneExpiredSceneLocks(workspaceId) {
      const workspaceSceneLocks = sceneLocks.get(workspaceId);
      if (!workspaceSceneLocks) {
        return [];
      }

      const expiredLocks: WorkspaceSceneUnlockMessage[] = [];
      const now = getNow();
      for (const [sceneId, sceneUsers] of Array.from(workspaceSceneLocks.entries())) {
        for (const [userId, sceneLock] of Array.from(sceneUsers.entries())) {
          if (now - sceneLock.lastHeartbeatAt < heartbeatTimeoutMs) {
            continue;
          }

          for (const connectionId of sceneLock.connectionIds) {
            connections.get(connectionId)?.lockedScenes.delete(sceneId);
          }

          deleteSceneLock(workspaceId, sceneId, userId);
          expiredLocks.push({
            type: "scene:unlock",
            workspaceId,
            sceneId,
            userId,
            holders: getSceneLockUsers(workspaceId, sceneId),
            reason: "timeout",
          });
        }
      }

      return expiredLocks;
    },

    lockScene({ connectionId, sceneId }) {
      const connection = connections.get(connectionId);
      if (!connection) {
        return null;
      }

      let workspaceSceneLocks = sceneLocks.get(connection.workspaceId);
      if (!workspaceSceneLocks) {
        workspaceSceneLocks = new Map<string, Map<string, WorkspaceSceneLockState>>();
        sceneLocks.set(connection.workspaceId, workspaceSceneLocks);
      }

      let sceneUsers = workspaceSceneLocks.get(sceneId);
      if (!sceneUsers) {
        sceneUsers = new Map<string, WorkspaceSceneLockState>();
        workspaceSceneLocks.set(sceneId, sceneUsers);
      }

      const existingLock = sceneUsers.get(connection.userId);
      const now = getNow();
      if (existingLock) {
        existingLock.lastHeartbeatAt = now;
        existingLock.connectionIds.add(connectionId);
        connection.lockedScenes.add(sceneId);
        return null;
      }

      sceneUsers.set(connection.userId, {
        workspaceId: connection.workspaceId,
        sceneId,
        userId: connection.userId,
        connectionIds: new Set<string>([connectionId]),
        lastHeartbeatAt: now,
      });
      connection.lockedScenes.add(sceneId);

      const holders = getSceneLockUsers(connection.workspaceId, sceneId);
      return {
        type: "scene:lock",
        workspaceId: connection.workspaceId,
        sceneId,
        userId: connection.userId,
        holders,
        warning: holders.some((holderUserId) => holderUserId !== connection.userId),
      };
    },

    unlockScene({ connectionId, sceneId, reason = "explicit" }) {
      return releaseSceneLock(connectionId, sceneId, reason);
    },

    getPresence(workspaceId) {
      const workspacePresence = presence.get(workspaceId);
      if (!workspacePresence) {
        return [];
      }

      return Array.from(workspacePresence.values())
        .map((entry) => toPresenceInfo(entry))
        .sort((left, right) => left.userId.localeCompare(right.userId));
    },

    getSceneLocks(workspaceId) {
      const workspaceSceneLocks = sceneLocks.get(workspaceId);
      if (!workspaceSceneLocks) {
        return [];
      }

      const result: WorkspaceSceneLockInfo[] = [];
      for (const [sceneId, sceneUsers] of workspaceSceneLocks.entries()) {
        for (const userId of sceneUsers.keys()) {
          result.push({ sceneId, userId });
        }
      }

      return result.sort((left, right) => {
        const sceneCompare = left.sceneId.localeCompare(right.sceneId);
        if (sceneCompare !== 0) {
          return sceneCompare;
        }

        return left.userId.localeCompare(right.userId);
      });
    },

    getWorkspaceConnectionCount(workspaceId) {
      return workspaceMembership.get(workspaceId)?.size ?? 0;
    },
  };
}
