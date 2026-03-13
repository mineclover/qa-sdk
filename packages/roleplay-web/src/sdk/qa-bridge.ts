import { QaLogger, HttpTransport, newQaSessionId } from "@qa-sdk/sdk";
import { getCoreEvent } from "@qa-sdk/event-catalog";
import { INGEST_SERVER_URL } from "../config.js";

export interface QaBridge {
  startSession(scenarioId?: string): { traceId: string; sessionId: string };
  emitEvent(eventKey: string, payload?: Record<string, unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export function createQaBridge(config?: { ingestUrl?: string }): QaBridge {
  const endpoint = config?.ingestUrl ?? INGEST_SERVER_URL;

  const transport = new HttpTransport({
    endpoint: `${endpoint}/v1/ingest`,
  });

  const logger = new QaLogger({
    transport,
    owner: { owner_type: "tenant", owner_id: "qa-roleplay" },
    source: {
      service_name: "roleplay-web",
      sdk_name: "@qa-sdk/sdk",
      sdk_version: "0.1.0",
    },
    runtime: {
      platform: "browser",
      os_version: navigator.userAgent,
    },
    build: { env: "local" },
    flushIntervalMs: 3_000,
  });

  return {
    startSession(
      scenarioId?: string,
    ): { traceId: string; sessionId: string } {
      const sessionId = newQaSessionId();
      const ctx = logger.startTrace({ qa_session_id: sessionId });

      if (scenarioId) {
        logger.log({
          event_key: "session_start",
          event_version: resolveVersion("session_start"),
          payload: { scenario_id: scenarioId },
        });
      }

      return { traceId: ctx.trace_id, sessionId };
    },

    emitEvent(eventKey: string, payload?: Record<string, unknown>): void {
      logger.log({
        event_key: eventKey,
        event_version: resolveVersion(eventKey),
        payload,
      });
    },

    async flush(): Promise<void> {
      await logger.flush();
    },

    async shutdown(): Promise<void> {
      await logger.shutdown();
    },
  };
}

function resolveVersion(eventKey: string): string {
  const def = getCoreEvent(eventKey);
  return def?.event_version ?? "1";
}
