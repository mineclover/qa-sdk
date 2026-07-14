// @def.boundary viz-system-root
// @def.doc viz-system-root

import type { StoredRecord } from '@qa-sdk/core';
import { INGEST_SERVER_URL } from '../config';

export interface SseHandlers {
  onRecord: (record: StoredRecord) => void;
  onClose: (reason: string) => void;
  onError: (error: Event) => void;
}

/**
 * Subscribe to a trace's SSE stream.
 * Returns an unsubscribe function that closes the EventSource.
 */
export function subscribeToTrace(traceId: string, handlers: SseHandlers): () => void {
  const url = `${INGEST_SERVER_URL}/v1/streams/traces/${encodeURIComponent(traceId)}`;
  const source = new EventSource(url);

  source.addEventListener('record', (evt: MessageEvent) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(evt.data as string) as unknown;
    } catch (err) {
      console.error("[viz-web:sse] JSON parse error on 'record' event", err, evt.data);
      return;
    }
    if (
      parsed == null ||
      typeof parsed !== 'object' ||
      typeof (parsed as Record<string, unknown>)['log_id'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['event_key'] !== 'string'
    ) {
      console.error(
        "[viz-web:sse] malformed 'record' payload — missing log_id or event_key",
        parsed,
      );
      return;
    }
    handlers.onRecord(parsed as StoredRecord);
  });

  source.addEventListener('close', (evt: MessageEvent) => {
    let reason = 'unknown';
    try {
      const data = JSON.parse(evt.data as string) as Record<string, unknown>;
      if (typeof data['reason'] === 'string') reason = data['reason'];
    } catch (err) {
      console.error("[viz-web:sse] JSON parse error on 'close' event", err, evt.data);
    }
    handlers.onClose(reason);
    source.close();
  });

  source.addEventListener('error', (evt) => {
    handlers.onError(evt);
  });

  return () => {
    source.close();
  };
}
