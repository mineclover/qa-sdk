import type { NodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { Context } from "hono";
import type { WSEvents, WSContext } from "hono/ws";
import type { MotionWorkspaceController } from "../controller.js";
import {
  createInvalidJsonError,
  createInvalidRequestError,
} from "../errors.js";
import {
  parseWorkspaceWsPresenceMessage,
  parseWorkspaceWsSceneControlMessage,
  type WorkspaceSceneUnlockMessage,
  type WorkspaceWsServerMessage,
} from "../ws-protocol.js";
import type { WorkspaceWsHub } from "../ws-hub.js";

async function parseJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw createInvalidJsonError(reason);
  }
}

export interface MotionWorkspaceRouteDeps {
  readonly controller: MotionWorkspaceController;
  readonly upgradeWebSocket: NodeWebSocket["upgradeWebSocket"];
  readonly wsHub: WorkspaceWsHub;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendWsJson(ws: WSContext, payload: unknown): void {
  ws.send(JSON.stringify(payload));
}

function broadcastWsMessage(
  hub: WorkspaceWsHub,
  workspaceId: string,
  message: WorkspaceWsServerMessage,
): void {
  hub.broadcast(workspaceId, JSON.stringify(message));
}

function broadcastSceneUnlocks(
  hub: WorkspaceWsHub,
  messages: readonly WorkspaceSceneUnlockMessage[],
): void {
  for (const message of messages) {
    broadcastWsMessage(hub, message.workspaceId, message);
  }
}

function disconnectWorkspaceConnection(
  hub: WorkspaceWsHub,
  connectionId: string,
): void {
  const presenceMessage = hub.clearPresence(connectionId);
  const unlockMessages = hub.disconnect(connectionId);
  if (presenceMessage) {
    broadcastWsMessage(hub, presenceMessage.workspaceId, presenceMessage);
  }
  broadcastSceneUnlocks(hub, unlockMessages);
}

function broadcastSceneUpdated(
  hub: WorkspaceWsHub,
  workspaceId: string,
  sceneId: string,
  revision: number,
): void {
  broadcastWsMessage(hub, workspaceId, {
    type: "scene:updated",
    workspaceId,
    sceneId,
    revision,
  });
}

function broadcastResourceUpdated(
  hub: WorkspaceWsHub,
  workspaceId: string,
  revision: number,
): void {
  broadcastWsMessage(hub, workspaceId, {
    type: "resource:updated",
    workspaceId,
    revision,
  });
}

function isResourceMutationApplyRequest(input: unknown): boolean {
  return isRecord(input)
    && isRecord(input["command"])
    && input["command"]["type"] === "set-composition";
}

function requireUserId(c: Context): string {
  const userId = c.req.query("userId")?.trim();
  if (!userId) {
    throw createInvalidRequestError("userId query가 필요합니다.");
  }

  return userId;
}

function requireWorkspaceId(c: Context): string {
  const workspaceId = c.req.param("id");
  if (!workspaceId) {
    throw createInvalidRequestError("workspace id가 필요합니다.");
  }

  return workspaceId;
}

export function createWorkspaceWsEvents(
  c: Context,
  hub: WorkspaceWsHub,
): WSEvents {
  const workspaceId = requireWorkspaceId(c);
  const userId = requireUserId(c);
  let connectionId: string | null = null;

  return {
    onOpen(_event, ws) {
      const connection = hub.connect({
        workspaceId,
        userId,
        socket: ws,
      });
      connectionId = connection.connectionId;
      broadcastSceneUnlocks(hub, hub.pruneExpiredSceneLocks(workspaceId));
      sendWsJson(ws, {
        type: "connected",
        workspaceId,
        userId,
        sceneLocks: hub.getSceneLocks(workspaceId),
        presences: hub.getPresence(workspaceId),
      });
    },

    onMessage(event, ws) {
      try {
        const raw = typeof event.data === "string"
          ? event.data
          : String(event.data);
        const payload = JSON.parse(raw);
        if (!connectionId) {
          sendWsJson(ws, {
            type: "error",
            code: "not_connected",
            message: "WS 연결이 아직 초기화되지 않았습니다.",
          });
          return;
        }

        broadcastSceneUnlocks(hub, hub.pruneExpiredSceneLocks(workspaceId));

        const presenceMessage = parseWorkspaceWsPresenceMessage(payload);
        if (presenceMessage === "invalid") {
          sendWsJson(ws, {
            type: "error",
            code: "invalid_request",
            message: "presence payload는 { type, userId, activeSceneId?, cursor? } 형식이어야 합니다.",
          });
          return;
        }

        if (presenceMessage) {
          if (presenceMessage.userId !== userId) {
            sendWsJson(ws, {
              type: "error",
              code: "invalid_request",
              message: "presence userId는 연결 userId와 일치해야 합니다.",
            });
            return;
          }

          const nextPresence = hub.updatePresence({
            connectionId,
            activeSceneId: presenceMessage.activeSceneId,
            cursor: presenceMessage.cursor,
          });
          if (nextPresence) {
            broadcastWsMessage(hub, workspaceId, nextPresence);
          }
          return;
        }

        const sceneControlMessage = parseWorkspaceWsSceneControlMessage(payload);
        if (sceneControlMessage === "invalid") {
          sendWsJson(ws, {
            type: "error",
            code: "invalid_request",
            message: "scene lock/unlock payload는 { type, sceneId, userId } 형식이어야 합니다.",
          });
          return;
        }

        if (sceneControlMessage) {
          if (sceneControlMessage.userId !== userId) {
            sendWsJson(ws, {
              type: "error",
              code: "invalid_request",
              message: "scene lock/unlock userId는 연결 userId와 일치해야 합니다.",
            });
            return;
          }

          if (sceneControlMessage.type === "scene:lock") {
            const lockMessage = hub.lockScene({
              connectionId,
              sceneId: sceneControlMessage.sceneId,
            });
            if (lockMessage) {
              broadcastWsMessage(hub, workspaceId, lockMessage);
            }
            return;
          }

          const unlockMessage = hub.unlockScene({
            connectionId,
            sceneId: sceneControlMessage.sceneId,
            reason: "explicit",
          });
          if (unlockMessage) {
            broadcastWsMessage(hub, workspaceId, unlockMessage);
          }
          return;
        }

        broadcastWsMessage(hub, workspaceId, {
          type: "workspace-message",
          workspaceId,
          userId,
          payload,
        });
      } catch {
        sendWsJson(ws, {
          type: "error",
          code: "invalid_json",
          message: "WS payload는 JSON 이어야 합니다.",
        });
      }
    },

    onClose() {
      if (connectionId) {
        disconnectWorkspaceConnection(hub, connectionId);
      }
    },

    onError() {
      if (connectionId) {
        disconnectWorkspaceConnection(hub, connectionId);
      }
    },
  };
}

export function createWorkspaceRoutes(
  deps: MotionWorkspaceRouteDeps,
) {
  const app = new Hono();

  app.get("/workspaces", async (c) => {
    return c.json(await deps.controller.listWorkspaces());
  });

  app.get(
    "/workspaces/:id/ws",
    deps.upgradeWebSocket((c) => createWorkspaceWsEvents(c, deps.wsHub)),
  );

  app.get("/workspaces/:id", async (c) => {
    return c.json(await deps.controller.getWorkspace(c.req.param("id")));
  });

  app.get("/workspaces/:id/scenes", async (c) => {
    return c.json(await deps.controller.listScenes(c.req.param("id")));
  });

  app.get("/workspaces/:id/scenes/:sceneId", async (c) => {
    return c.json(await deps.controller.getScene(
      c.req.param("id"),
      c.req.param("sceneId"),
    ));
  });

  app.put("/workspaces/:id/scenes/:sceneId", async (c) => {
    const body = await parseJsonBody(c);
    const response = await deps.controller.updateScene(
      c.req.param("id"),
      c.req.param("sceneId"),
      body,
    );
    broadcastSceneUpdated(
      deps.wsHub,
      c.req.param("id"),
      c.req.param("sceneId"),
      response.revision,
    );
    return c.json(response);
  });

  app.post("/workspaces/:id/scenes", async (c) => {
    const body = await parseJsonBody(c);
    const response = await deps.controller.createScene(c.req.param("id"), body);
    broadcastResourceUpdated(
      deps.wsHub,
      c.req.param("id"),
      response.globalRevision,
    );
    return c.json(response);
  });

  app.put("/workspaces/:id", async (c) => {
    const body = await parseJsonBody(c);
    return c.json(await deps.controller.createWorkspace(c.req.param("id"), body));
  });

  app.post("/workspaces/:id", async (c) => {
    const body = await parseJsonBody(c);
    const response = await deps.controller.updateWorkspace(c.req.param("id"), body);
    broadcastResourceUpdated(
      deps.wsHub,
      c.req.param("id"),
      response.workspace.globalRevision,
    );
    return c.json(response);
  });

  app.post("/workspaces/:id/apply-command", async (c) => {
    const body = await parseJsonBody(c);
    const response = await deps.controller.applyCommand(c.req.param("id"), body);
    if (isResourceMutationApplyRequest(body)) {
      broadcastResourceUpdated(
        deps.wsHub,
        c.req.param("id"),
        response.workspace.globalRevision,
      );
    }
    return c.json(response);
  });

  app.delete("/workspaces/:id", async (c) => {
    await deps.controller.deleteWorkspace(c.req.param("id"));
    return c.body(null, 204);
  });

  app.delete("/workspaces/:id/scenes/:sceneId", async (c) => {
    const body = await parseJsonBody(c);
    const response = await deps.controller.deleteScene(
      c.req.param("id"),
      c.req.param("sceneId"),
      body,
    );
    broadcastResourceUpdated(
      deps.wsHub,
      c.req.param("id"),
      response.globalRevision,
    );
    return c.json(response);
  });

  return app;
}
