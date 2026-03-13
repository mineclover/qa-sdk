import type { StoredRecord } from "@qa-sdk/core";
import { INGEST_SERVER_URL } from "../config";

export interface SseHandlers {
  onRecord: (record: StoredRecord) => void;
  onClose: (reason: string) => void;
  onError: (error: Event) => void;
}

/**
 * Subscribe to a trace's SSE stream.
 * Returns an unsubscribe function that closes the EventSource.
 */
export function subscribeToTrace(
  traceId: string,
  handlers: SseHandlers,
): () => void {
  const url = `${INGEST_SERVER_URL}/v1/streams/traces/${encodeURIComponent(traceId)}`;
  const source = new EventSource(url);

  source.addEventListener("record", (evt: MessageEvent) => {
    try {
      const record = JSON.parse(evt.data) as StoredRecord;
      handlers.onRecord(record);
    } catch {
      // malformed data; skip
    }
  });

  source.addEventListener("close", (evt: MessageEvent) => {
    try {
      const data = JSON.parse(evt.data) as { reason: string };
      handlers.onClose(data.reason);
    } catch {
      handlers.onClose("unknown");
    }
    source.close();
  });

  source.onerror = (evt) => {
    handlers.onError(evt);
  };

  return () => {
    source.close();
  };
}
