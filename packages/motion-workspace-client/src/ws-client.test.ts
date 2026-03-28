import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionWorkspaceClient } from "./client.js";
import type {
  MotionWorkspaceWebSocketLike,
  MotionWorkspaceWsCloseEvent,
  MotionWorkspaceWsHandlers,
  MotionWorkspaceWsMessageEvent,
  MotionWorkspaceWsReconnectEvent,
  MotionWorkspaceWsServerMessage,
} from "./ws-client.js";

const originalFetch = globalThis.fetch;

class FakeWebSocket implements MotionWorkspaceWebSocketLike {
  readonly url: string;
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: MotionWorkspaceWsMessageEvent) => void) | null = null;
  onclose: ((event: MotionWorkspaceWsCloseEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly sent: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.onclose?.({
      code,
      reason,
      wasClean: code === 1000,
    });
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  receive(payload: unknown): void {
    this.onmessage?.({
      data: JSON.stringify(payload),
    });
  }

  fail(error: unknown): void {
    this.onerror?.(error);
  }
}

function createWebSocketHarness() {
  const sockets: FakeWebSocket[] = [];

  return {
    sockets,
    createWebSocket(url: string): MotionWorkspaceWebSocketLike {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(globalThis, "fetch", {
    value: originalFetch,
    configurable: true,
    writable: true,
  });
});

describe("motion workspace websocket client", () => {
  it("connects to the workspace ws endpoint, dispatches typed handlers, and sends scene/presence commands", async () => {
    Object.defineProperty(globalThis, "fetch", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { createWebSocket, sockets } = createWebSocketHarness();
    const messages: MotionWorkspaceWsServerMessage[] = [];
    const reconnects: MotionWorkspaceWsReconnectEvent[] = [];
    const connected: MotionWorkspaceWsServerMessage[] = [];
    const sceneUpdates: MotionWorkspaceWsServerMessage[] = [];
    const resourceUpdates: MotionWorkspaceWsServerMessage[] = [];
    const locks: MotionWorkspaceWsServerMessage[] = [];
    const unlocks: MotionWorkspaceWsServerMessage[] = [];
    const presences: MotionWorkspaceWsServerMessage[] = [];
    const workspaceMessages: MotionWorkspaceWsServerMessage[] = [];
    const serverErrors: MotionWorkspaceWsServerMessage[] = [];
    const transportErrors: unknown[] = [];
    const disconnects: MotionWorkspaceWsCloseEvent[] = [];

    const handlers: MotionWorkspaceWsHandlers = {
      userId: "alice",
      createWebSocket,
      onMessage(message) {
        messages.push(message);
      },
      onConnected(message) {
        connected.push(message);
      },
      onSceneUpdated(message) {
        sceneUpdates.push(message);
      },
      onResourceUpdated(message) {
        resourceUpdates.push(message);
      },
      onSceneLock(message) {
        locks.push(message);
      },
      onSceneUnlock(message) {
        unlocks.push(message);
      },
      onPresence(message) {
        presences.push(message);
      },
      onWorkspaceMessage(message) {
        workspaceMessages.push(message);
      },
      onServerError(message) {
        serverErrors.push(message);
      },
      onTransportError(error) {
        transportErrors.push(error);
      },
      onReconnect(event) {
        reconnects.push(event);
      },
      onDisconnected(event) {
        disconnects.push(event);
      },
    };

    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api",
    });
    const connection = client.connectWorkspace("demo/workspace 1", handlers);

    await flushMicrotasks();

    expect(sockets).toHaveLength(1);
    const socket = sockets[0]!;
    expect(socket.url).toBe(
      "wss://workspace.qa/api/workspaces/demo%2Fworkspace%201/ws?userId=alice",
    );

    socket.open();
    socket.receive({
      type: "connected",
      workspaceId: "demo/workspace 1",
      userId: "alice",
      sceneLocks: [],
      presences: [],
    });
    socket.receive({
      type: "scene:updated",
      workspaceId: "demo/workspace 1",
      sceneId: "scene-a",
      revision: 2,
    });
    socket.receive({
      type: "resource:updated",
      workspaceId: "demo/workspace 1",
      revision: 3,
    });
    socket.receive({
      type: "scene:lock",
      workspaceId: "demo/workspace 1",
      sceneId: "scene-a",
      userId: "bob",
      holders: ["alice", "bob"],
      warning: true,
    });
    socket.receive({
      type: "scene:unlock",
      workspaceId: "demo/workspace 1",
      sceneId: "scene-a",
      userId: "bob",
      holders: ["alice"],
      reason: "explicit",
    });
    socket.receive({
      type: "presence",
      workspaceId: "demo/workspace 1",
      userId: "bob",
      activeSceneId: "scene-b",
      cursor: { x: 44, y: 88 },
    });
    socket.receive({
      type: "workspace-message",
      workspaceId: "demo/workspace 1",
      userId: "bob",
      payload: { type: "cursor-update", x: 12, y: 34 },
    });
    socket.receive({
      type: "error",
      code: "invalid_request",
      message: "bad payload",
    });

    connection.lockScene("scene-a");
    connection.sendPresence({
      activeSceneId: "scene-a",
      cursor: { x: 12, y: 24 },
    });
    connection.unlockScene("scene-a");

    expect(messages.map((message) => message.type)).toEqual([
      "connected",
      "scene:updated",
      "resource:updated",
      "scene:lock",
      "scene:unlock",
      "presence",
      "workspace-message",
      "error",
    ]);
    expect(connected).toHaveLength(1);
    expect(sceneUpdates).toEqual([
      {
        type: "scene:updated",
        workspaceId: "demo/workspace 1",
        sceneId: "scene-a",
        revision: 2,
      },
    ]);
    expect(resourceUpdates).toEqual([
      {
        type: "resource:updated",
        workspaceId: "demo/workspace 1",
        revision: 3,
      },
    ]);
    expect(locks).toEqual([
      {
        type: "scene:lock",
        workspaceId: "demo/workspace 1",
        sceneId: "scene-a",
        userId: "bob",
        holders: ["alice", "bob"],
        warning: true,
      },
    ]);
    expect(unlocks).toEqual([
      {
        type: "scene:unlock",
        workspaceId: "demo/workspace 1",
        sceneId: "scene-a",
        userId: "bob",
        holders: ["alice"],
        reason: "explicit",
      },
    ]);
    expect(presences).toEqual([
      {
        type: "presence",
        workspaceId: "demo/workspace 1",
        userId: "bob",
        activeSceneId: "scene-b",
        cursor: { x: 44, y: 88 },
      },
    ]);
    expect(workspaceMessages).toEqual([
      {
        type: "workspace-message",
        workspaceId: "demo/workspace 1",
        userId: "bob",
        payload: { type: "cursor-update", x: 12, y: 34 },
      },
    ]);
    expect(serverErrors).toEqual([
      {
        type: "error",
        code: "invalid_request",
        message: "bad payload",
      },
    ]);
    expect(reconnects).toEqual([]);
    expect(transportErrors).toEqual([]);
    expect(socket.sent.map((payload) => JSON.parse(payload) as unknown)).toEqual([
      {
        type: "scene:lock",
        sceneId: "scene-a",
        userId: "alice",
      },
      {
        type: "presence",
        userId: "alice",
        activeSceneId: "scene-a",
        cursor: { x: 12, y: 24 },
      },
      {
        type: "scene:unlock",
        sceneId: "scene-a",
        userId: "alice",
      },
    ]);

    connection.disconnect();
    expect(disconnects).toEqual([
      {
        code: 1000,
        reason: "client_disconnect",
        wasClean: true,
      },
    ]);
  });

  it("reconnects with exponential backoff and replays desired state after the next connected event", async () => {
    vi.useFakeTimers();

    const { createWebSocket, sockets } = createWebSocketHarness();
    const reconnects: MotionWorkspaceWsReconnectEvent[] = [];

    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api",
    });
    const connection = client.connectWorkspace("demo/reconnect", {
      userId: "alice",
      createWebSocket,
      reconnect: {
        initialDelayMs: 100,
        maxDelayMs: 400,
        multiplier: 2,
      },
      onReconnect(event) {
        reconnects.push(event);
      },
    });

    await flushMicrotasks();

    const firstSocket = sockets[0]!;
    firstSocket.open();
    firstSocket.receive({
      type: "connected",
      workspaceId: "demo/reconnect",
      userId: "alice",
      sceneLocks: [],
      presences: [],
    });

    connection.lockScene("scene-a");
    connection.sendPresence({
      activeSceneId: "scene-a",
      cursor: { x: 1, y: 2 },
    });

    expect(firstSocket.sent.map((payload) => JSON.parse(payload) as unknown)).toEqual([
      {
        type: "scene:lock",
        sceneId: "scene-a",
        userId: "alice",
      },
      {
        type: "presence",
        userId: "alice",
        activeSceneId: "scene-a",
        cursor: { x: 1, y: 2 },
      },
    ]);

    firstSocket.close(1006, "network_lost");
    expect(reconnects).toEqual([
      {
        attempt: 1,
        delayMs: 100,
        workspaceId: "demo/reconnect",
        userId: "alice",
      },
    ]);

    await vi.advanceTimersByTimeAsync(100);
    expect(sockets).toHaveLength(2);

    const secondSocket = sockets[1]!;
    secondSocket.open();
    secondSocket.close(1006, "network_lost_again");
    expect(reconnects).toEqual([
      {
        attempt: 1,
        delayMs: 100,
        workspaceId: "demo/reconnect",
        userId: "alice",
      },
      {
        attempt: 2,
        delayMs: 200,
        workspaceId: "demo/reconnect",
        userId: "alice",
      },
    ]);

    await vi.advanceTimersByTimeAsync(200);
    expect(sockets).toHaveLength(3);

    const thirdSocket = sockets[2]!;
    thirdSocket.open();
    thirdSocket.receive({
      type: "connected",
      workspaceId: "demo/reconnect",
      userId: "alice",
      sceneLocks: [],
      presences: [],
    });

    expect(thirdSocket.sent.map((payload) => JSON.parse(payload) as unknown)).toEqual([
      {
        type: "scene:lock",
        sceneId: "scene-a",
        userId: "alice",
      },
      {
        type: "presence",
        userId: "alice",
        activeSceneId: "scene-a",
        cursor: { x: 1, y: 2 },
      },
    ]);

    connection.disconnect();
  });
});
