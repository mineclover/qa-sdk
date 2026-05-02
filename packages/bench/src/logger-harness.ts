import { getCoreEvent } from "@qa-sdk/event-catalog";
import { QaLogger, newQaSessionId } from "@qa-sdk/sdk";
import { createErrorTracker, createInstrumentedHarness } from "./harness.js";
import { createProbeTransport } from "./probe-transport.js";
import type { BenchmarkHarness, QaLoggerBenchmarkHarnessConfig } from "./types.js";

export function createQaLoggerBenchmarkHarness(
  config: QaLoggerBenchmarkHarnessConfig,
): BenchmarkHarness {
  const errorTracker = createErrorTracker();
  const probeTransport = createProbeTransport(config.transport, {
    measureEnvelopeBytes: config.measureEnvelopeBytes,
  });

  const logger = new QaLogger({
    ...config,
    transport: probeTransport,
    onError: (error, context) => {
      errorTracker.record(context);
      config.onError?.(error, context);
    },
  });

  return createInstrumentedHarness(
    {
      startSession(
        scenarioId?: string,
        existingSessionId?: string,
      ): { traceId: string; sessionId: string } {
        const sessionId = existingSessionId ?? newQaSessionId();
        const trace = logger.startTrace({ qa_session_id: sessionId });

        if (scenarioId) {
          logger.log({
            event_key: "session_start",
            event_version: resolveEventVersion("session_start"),
            payload: { scenario_id: scenarioId },
          });
        }

        return { traceId: trace.trace_id, sessionId };
      },

      emitEvent(
        eventKey: string,
        payload?: Record<string, unknown>,
        options?: { eventVersion?: string; address_context?: Record<string, string> },
      ): void {
        logger.log({
          event_key: eventKey,
          event_version: resolveEventVersion(eventKey, options?.eventVersion),
          payload,
          ...(options?.address_context ? { address_context: options.address_context } : {}),
        });
      },

      emitMetric(name, value, options) {
        logger.metric(name, value, options);
      },

      async flush(): Promise<void> {
        await logger.flush();
      },

      async shutdown(): Promise<void> {
        await logger.shutdown();
      },
    },
    {
      probeTransport,
      onReset: () => errorTracker.reset(),
      getErrors: () => errorTracker.snapshot(),
    },
  );
}

function resolveEventVersion(eventKey: string, explicitVersion?: string): string {
  if (explicitVersion) {
    return explicitVersion.padStart(3, "0");
  }

  return (getCoreEvent(eventKey)?.event_version ?? "1").padStart(3, "0");
}
