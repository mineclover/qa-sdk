import type { TransmissionEnvelope } from '@qa-sdk/sdk';
import type {
  BenchmarkBridge,
  BenchmarkClient,
  BenchmarkCounters,
  BenchmarkErrorSummary,
  BenchmarkHarness,
  BenchmarkWorkerSnapshot,
  ProbeTransport,
} from './types.js';
import { summarizeEnvelopes } from './probe-transport.js';

export function createInstrumentedHarness(
  client: BenchmarkClient,
  options: {
    probeTransport?: ProbeTransport;
    bridge?: Pick<BenchmarkBridge, 'getDebugEnvelopes'>;
    onReset?: () => void;
    getErrors?: () => BenchmarkErrorSummary | undefined;
  } = {},
): BenchmarkHarness {
  let counters = emptyCounters();
  let bridgeBaselineIndex = options.bridge?.getDebugEnvelopes?.()?.length ?? 0;

  const instrumentedClient: BenchmarkClient = {
    startSession(scenarioId?: string, existingSessionId?: string) {
      counters.sessionsStarted += 1;
      return client.startSession(scenarioId, existingSessionId);
    },

    emitEvent(eventKey, payload, config) {
      counters.eventsEmitted += 1;
      client.emitEvent(eventKey, payload, config);
    },

    emitMetric(name, value, config) {
      counters.metricsEmitted += 1;
      client.emitMetric(name, value, config);
    },

    async flush() {
      counters.flushCalls += 1;
      await client.flush();
    },

    async shutdown() {
      await client.shutdown();
    },
  };

  return {
    client: instrumentedClient,

    reset() {
      counters = emptyCounters();
      options.probeTransport?.reset();
      bridgeBaselineIndex = options.bridge?.getDebugEnvelopes?.()?.length ?? 0;
      options.onReset?.();
    },

    snapshot(): BenchmarkWorkerSnapshot {
      const errors = options.getErrors?.();
      const bridgeEnvelopes = options.bridge?.getDebugEnvelopes?.();
      const bridgeDelta = bridgeEnvelopes
        ? summarizeEnvelopes(bridgeEnvelopes.slice(bridgeBaselineIndex), {
            measureEnvelopeBytes: true,
          })
        : undefined;

      return {
        counters: { ...counters },
        ...(options.probeTransport
          ? { transport: options.probeTransport.snapshot() }
          : bridgeDelta
            ? {
                transport: {
                  envelopesSent: bridgeDelta.envelopesSent,
                  recordsSent: bridgeDelta.recordsSent,
                  failedSends: 0,
                  sendLatencyMs: { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 },
                  ...(typeof bridgeDelta.bytesSent === 'number'
                    ? { bytesSent: bridgeDelta.bytesSent }
                    : {}),
                  addressContext: bridgeDelta.addressContext,
                },
              }
            : {}),
        ...(errors ? { errors } : {}),
      };
    },
  };
}

export function createErrorTracker() {
  let total = 0;
  let byContext: Record<string, number> = {};

  return {
    record(context: string): void {
      total += 1;
      byContext = {
        ...byContext,
        [context]: (byContext[context] ?? 0) + 1,
      };
    },

    reset(): void {
      total = 0;
      byContext = {};
    },

    snapshot(): BenchmarkErrorSummary | undefined {
      if (total === 0) return undefined;
      return { total, byContext: { ...byContext } };
    },
  };
}

function emptyCounters(): BenchmarkCounters {
  return {
    sessionsStarted: 0,
    eventsEmitted: 0,
    metricsEmitted: 0,
    flushCalls: 0,
  };
}
