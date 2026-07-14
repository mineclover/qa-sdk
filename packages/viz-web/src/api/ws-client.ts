// @def.boundary viz-system-root
// @def.doc viz-system-root

import type { StoredRecord } from '@qa-sdk/core';
import { INGEST_SERVER_URL } from '../config';

const WS_URL = INGEST_SERVER_URL.replace(/^http/, 'ws');

export interface WsHandlers {
  onRecord(record: StoredRecord, scenarioId: string): void;
  onSubscribed(scenarioId: string): void;
  onSessionActive(sessionId: string, scenarioId: string): void;
  onDisconnected(): void;
  onError(event: Event): void;
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

  ws.addEventListener('open', () => {
    for (const scenarioId of pendingSubscriptions.splice(0)) {
      ws.send(JSON.stringify({ type: 'subscribe', scenarioId }));
    }
  });

  ws.addEventListener('message', (evt) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(evt.data as string) as Record<string, unknown>;
    } catch (err) {
      console.error('[viz-web:ws] JSON parse error', err, evt.data);
      return;
    }

    switch (msg['type']) {
      case 'record': {
        const data = msg['data'];
        const scenarioId = msg['scenarioId'];
        if (data == null || typeof scenarioId !== 'string') {
          console.error(
            "[viz-web:ws] malformed 'record' message — missing data or scenarioId",
            msg,
          );
          break;
        }
        handlers.onRecord(data as StoredRecord, scenarioId);
        break;
      }
      case 'subscribed': {
        const scenarioId = msg['scenarioId'];
        if (typeof scenarioId !== 'string') {
          console.error("[viz-web:ws] malformed 'subscribed' message — missing scenarioId", msg);
          break;
        }
        handlers.onSubscribed(scenarioId);
        break;
      }
      case 'session:active': {
        const sessionId = msg['sessionId'];
        const scenarioId = msg['scenarioId'];
        if (typeof sessionId !== 'string' || typeof scenarioId !== 'string') {
          console.error(
            "[viz-web:ws] malformed 'session:active' message — missing sessionId or scenarioId",
            msg,
          );
          break;
        }
        handlers.onSessionActive(sessionId, scenarioId);
        break;
      }
    }
  });

  ws.addEventListener('close', () => {
    handlers.onDisconnected();
  });

  ws.addEventListener('error', (evt) => {
    console.error('[viz-web:ws] WebSocket error', evt);
    handlers.onError(evt);
  });

  return {
    subscribe(scenarioId: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', scenarioId }));
      } else if (ws.readyState === WebSocket.CONNECTING) {
        pendingSubscriptions.push(scenarioId);
      }
    },
    unsubscribe(scenarioId: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', scenarioId }));
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
