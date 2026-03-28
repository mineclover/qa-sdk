import { describe, expect, it } from "vitest";
import { createWorkspaceWsHub } from "../src/ws-hub.js";

class FakeSocket {
  readonly messages: string[] = [];

  send(message: string): void {
    this.messages.push(message);
  }
}

describe("workspace ws hub", () => {
  it("tracks userId and broadcasts only within the same workspace", () => {
    const hub = createWorkspaceWsHub();
    const alphaSocketA = new FakeSocket();
    const alphaSocketB = new FakeSocket();
    const betaSocket = new FakeSocket();

    const alphaA = hub.connect({
      workspaceId: "workspace-alpha",
      userId: "alice",
      socket: alphaSocketA,
    });
    const alphaB = hub.connect({
      workspaceId: "workspace-alpha",
      userId: "bob",
      socket: alphaSocketB,
    });
    const beta = hub.connect({
      workspaceId: "workspace-beta",
      userId: "carol",
      socket: betaSocket,
    });

    expect(hub.getWorkspaceConnections("workspace-alpha")).toEqual([
      alphaA,
      alphaB,
    ]);
    expect(hub.getWorkspaceConnections("workspace-beta")).toEqual([beta]);

    hub.broadcast("workspace-alpha", JSON.stringify({
      type: "workspace-message",
      payload: { op: "ping" },
    }));

    expect(alphaSocketA.messages).toEqual([
      JSON.stringify({
        type: "workspace-message",
        payload: { op: "ping" },
      }),
    ]);
    expect(alphaSocketB.messages).toEqual([
      JSON.stringify({
        type: "workspace-message",
        payload: { op: "ping" },
      }),
    ]);
    expect(betaSocket.messages).toEqual([]);
  });

  it("applies soft scene locks and warns when another user already locked the scene", () => {
    const hub = createWorkspaceWsHub();
    const alphaSocketA = new FakeSocket();
    const alphaSocketB = new FakeSocket();
    const betaSocket = new FakeSocket();
    const alphaA = hub.connect({
      workspaceId: "workspace-alpha",
      userId: "alice",
      socket: alphaSocketA,
    });
    const alphaB = hub.connect({
      workspaceId: "workspace-alpha",
      userId: "bob",
      socket: alphaSocketB,
    });
    hub.connect({
      workspaceId: "workspace-beta",
      userId: "carol",
      socket: betaSocket,
    });

    expect(hub.lockScene({
      connectionId: alphaA.connectionId,
      sceneId: "scene-a",
    })).toEqual({
      type: "scene:lock",
      workspaceId: "workspace-alpha",
      sceneId: "scene-a",
      userId: "alice",
      holders: ["alice"],
      warning: false,
    });

    expect(hub.lockScene({
      connectionId: alphaB.connectionId,
      sceneId: "scene-a",
    })).toEqual({
      type: "scene:lock",
      workspaceId: "workspace-alpha",
      sceneId: "scene-a",
      userId: "bob",
      holders: ["alice", "bob"],
      warning: true,
    });

    expect(hub.getSceneLocks("workspace-alpha")).toEqual([
      { sceneId: "scene-a", userId: "alice" },
      { sceneId: "scene-a", userId: "bob" },
    ]);
    expect(hub.getSceneLocks("workspace-beta")).toEqual([]);
  });

  it("tracks presence by user and clears it when the last connection leaves", () => {
    const hub = createWorkspaceWsHub();
    const primarySocket = new FakeSocket();
    const secondarySocket = new FakeSocket();
    const primary = hub.connect({
      workspaceId: "workspace-presence",
      userId: "alice",
      socket: primarySocket,
    });
    const secondary = hub.connect({
      workspaceId: "workspace-presence",
      userId: "alice",
      socket: secondarySocket,
    });

    expect(hub.updatePresence({
      connectionId: primary.connectionId,
      activeSceneId: "scene-a",
      cursor: { x: 120, y: 44 },
    })).toEqual({
      type: "presence",
      workspaceId: "workspace-presence",
      userId: "alice",
      activeSceneId: "scene-a",
      cursor: { x: 120, y: 44 },
    });
    expect(hub.getPresence("workspace-presence")).toEqual([
      {
        userId: "alice",
        activeSceneId: "scene-a",
        cursor: { x: 120, y: 44 },
      },
    ]);

    expect(hub.updatePresence({
      connectionId: secondary.connectionId,
      activeSceneId: "scene-b",
    })).toEqual({
      type: "presence",
      workspaceId: "workspace-presence",
      userId: "alice",
      activeSceneId: "scene-b",
    });
    expect(hub.getPresence("workspace-presence")).toEqual([
      {
        userId: "alice",
        activeSceneId: "scene-b",
      },
    ]);

    expect(hub.clearPresence(primary.connectionId)).toBeNull();
    expect(hub.getPresence("workspace-presence")).toEqual([
      {
        userId: "alice",
        activeSceneId: "scene-b",
      },
    ]);

    expect(hub.clearPresence(secondary.connectionId)).toEqual({
      type: "presence",
      workspaceId: "workspace-presence",
      userId: "alice",
    });
    expect(hub.getPresence("workspace-presence")).toEqual([]);
  });

  it("releases scene locks when the connection disconnects", () => {
    const hub = createWorkspaceWsHub();
    const socket = new FakeSocket();
    const connection = hub.connect({
      workspaceId: "workspace-cleanup",
      userId: "dora",
      socket,
    });
    hub.lockScene({
      connectionId: connection.connectionId,
      sceneId: "scene-cleanup",
    });

    expect(hub.getWorkspaceConnectionCount("workspace-cleanup")).toBe(1);
    expect(hub.getSceneLocks("workspace-cleanup")).toEqual([
      { sceneId: "scene-cleanup", userId: "dora" },
    ]);

    expect(hub.disconnect(connection.connectionId)).toEqual([
      {
        type: "scene:unlock",
        workspaceId: "workspace-cleanup",
        sceneId: "scene-cleanup",
        userId: "dora",
        holders: [],
        reason: "disconnect",
      },
    ]);

    expect(hub.getWorkspaceConnectionCount("workspace-cleanup")).toBe(0);
    expect(hub.getSceneLocks("workspace-cleanup")).toEqual([]);
    expect(hub.getWorkspaceConnections("workspace-cleanup")).toEqual([]);
  });

  it("auto releases stale scene locks after the heartbeat timeout", () => {
    let now = 0;
    const hub = createWorkspaceWsHub({
      heartbeatTimeoutMs: 1_000,
      getNow: () => now,
    });
    const socket = new FakeSocket();
    const connection = hub.connect({
      workspaceId: "workspace-timeout",
      userId: "erin",
      socket,
    });

    expect(hub.lockScene({
      connectionId: connection.connectionId,
      sceneId: "scene-timeout",
    })).toEqual({
      type: "scene:lock",
      workspaceId: "workspace-timeout",
      sceneId: "scene-timeout",
      userId: "erin",
      holders: ["erin"],
      warning: false,
    });

    now = 900;
    expect(hub.lockScene({
      connectionId: connection.connectionId,
      sceneId: "scene-timeout",
    })).toBeNull();
    expect(hub.pruneExpiredSceneLocks("workspace-timeout")).toEqual([]);

    now = 1_950;
    expect(hub.pruneExpiredSceneLocks("workspace-timeout")).toEqual([
      {
        type: "scene:unlock",
        workspaceId: "workspace-timeout",
        sceneId: "scene-timeout",
        userId: "erin",
        holders: [],
        reason: "timeout",
      },
    ]);
    expect(hub.getSceneLocks("workspace-timeout")).toEqual([]);
  });
});
