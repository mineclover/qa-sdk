// @def.boundary ingest-system
// @def.doc ingest-system

import type { Context } from "hono";
import type { WSContext, WSEvents } from "hono/ws";
import type { RecordStreamBroker } from "../lib/record-stream-broker.js";
import type { Logger } from "pino";

export interface WsDeps {
  recordStreamBroker: RecordStreamBroker;
  logger?: Logger;
}

interface WsIncomingMessage {
  type: "subscribe" | "unsubscribe";
  scenarioId: string;
}

function isWsMessage(data: unknown): data is WsIncomingMessage {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d["type"] === "string" &&
    typeof d["scenarioId"] === "string" &&
    (d["type"] === "subscribe" || d["type"] === "unsubscribe")
  );
}

export function createWsHandler(deps: WsDeps): (c: Context) => WSEvents {
  return (_c: Context): WSEvents => {
    const unsubscribers = new Map<string, () => void>();
    // track which sessionIds have been seen per scenarioId subscription
    const seenSessions = new Map<string, Set<string>>();

    return {
      onMessage(evt: MessageEvent, ws: WSContext) {
        let msg: unknown;
        try {
          msg = JSON.parse(
            typeof evt.data === "string" ? evt.data : String(evt.data),
          );
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
          return;
        }

        if (!isWsMessage(msg)) {
          ws.send(
            JSON.stringify({ type: "error", message: "unknown message type" }),
          );
          return;
        }

        const { type, scenarioId } = msg;

        if (type === "subscribe") {
          if (unsubscribers.has(scenarioId)) return;

          if (deps.recordStreamBroker.isShuttingDown()) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "server shutting down",
              }),
            );
            return;
          }

          try {
            const sessionsSeen = new Set<string>();
            seenSessions.set(scenarioId, sessionsSeen);

            const unsubscribe = deps.recordStreamBroker.subscribeToScenario(
              scenarioId,
              (record) => {
                // detect new sessionId for this scenario and notify client
                if (record.qaSessionId && !sessionsSeen.has(record.qaSessionId)) {
                  sessionsSeen.add(record.qaSessionId);
                  ws.send(
                    JSON.stringify({
                      type: "session:active",
                      scenarioId,
                      sessionId: record.qaSessionId,
                    }),
                  );
                }
                ws.send(
                  JSON.stringify({ type: "record", scenarioId, data: record }),
                );
              },
            );
            unsubscribers.set(scenarioId, unsubscribe);
            ws.send(JSON.stringify({ type: "subscribed", scenarioId }));
          } catch {
            ws.send(
              JSON.stringify({ type: "error", message: "subscription failed" }),
            );
          }
        } else if (type === "unsubscribe") {
          const unsubscribe = unsubscribers.get(scenarioId);
          if (unsubscribe) {
            unsubscribe();
            unsubscribers.delete(scenarioId);
            seenSessions.delete(scenarioId);
            ws.send(JSON.stringify({ type: "unsubscribed", scenarioId }));
          }
        }
      },

      onClose() {
        for (const unsubscribe of unsubscribers.values()) {
          unsubscribe();
        }
        unsubscribers.clear();
      },

      onError(evt: Event) {
        deps.logger?.warn({ err: evt }, "ws connection error");
        for (const unsubscribe of unsubscribers.values()) {
          unsubscribe();
        }
        unsubscribers.clear();
      },
    };
  };
}
