import type { StoredRecord } from "@qa-sdk/core";
import { INGEST_SERVER_URL } from "../config";

const WS_URL = INGEST_SERVER_URL.replace(/^http/, "ws");

export interface WsHandlers {
  onRecord(record: StoredRecord, scenarioId: string): void;
  onSubscribed(scenarioId: string): void;
  onSessionActive(sessionId: string, scenarioId: string): void;
  onDisconnected(): void;
  onError?(event: Event): void;
}

export interface WsClient {
  subscribe(scenarioId: string): void;
  unsubscribe(scenarioId: string): void;
  disconnect(): void;
  readonly readyState: number;
}

export function createWsClient(handlers: WsHandlers): WsClient {
  const ws = new WebSocket(`${WS_URL}/v1/ws`);
  const pendingSubscriptions: string[] = [];

  ws.addEventListener("open", () => {
    for (const scenarioId of pendingSubscriptions.splice(0)) {
      ws.send(JSON.stringify({ type: "subscribe", scenarioId }));
    }
  });

  ws.addEventListener("message", (evt) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(evt.data as string) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg["type"]) {
      case "record":
        handlers.onRecord(msg["data"] as StoredRecord, msg["scenarioId"] as string);
        break;
      case "subscribed":
        handlers.onSubscribed(msg["scenarioId"] as string);
        break;
      case "session:active":
        handlers.onSessionActive(msg["sessionId"] as string, msg["scenarioId"] as string);
        break;
    }
  });

  ws.addEventListener("close", () => {
    handlers.onDisconnected();
  });

  ws.addEventListener("error", (evt) => {
    handlers.onError?.(evt);
  });

  return {
    subscribe(scenarioId: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "subscribe", scenarioId }));
      } else if (ws.readyState === WebSocket.CONNECTING) {
        pendingSubscriptions.push(scenarioId);
      }
    },
    unsubscribe(scenarioId: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe", scenarioId }));
      }
    },
    disconnect() {
      ws.close();
    },
    get readyState() {
      return ws.readyState;
    },
  };
}
