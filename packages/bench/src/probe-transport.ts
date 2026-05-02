import type { TransmissionEnvelope, Transport } from "@qa-sdk/sdk";
import type {
  AddressContextCoverage,
  DistributionSummary,
  ProbeTransport,
  ProbeTransportOptions,
  TransportProbeSnapshot,
} from "./types.js";

interface MutableTransportStats {
  envelopesSent: number;
  recordsSent: number;
  failedSends: number;
  bytesSent?: number;
  sendLatencies: number[];
  addressContext: MutableAddressContextCoverage;
}

interface MutableAddressContextCoverage {
  totalRecords: number;
  recordsWithAddressContext: number;
  prefixes: Record<string, number>;
}

export function createProbeTransport(
  baseTransport: Transport,
  options: ProbeTransportOptions = {},
): ProbeTransport {
  let stats = createEmptyStats(options.measureEnvelopeBytes ?? false);

  return {
    async send(envelope: TransmissionEnvelope): Promise<void> {
      const started = performance.now();
      try {
        await baseTransport.send(envelope);
        applyEnvelopeStats(stats, envelope);
        stats.sendLatencies.push(performance.now() - started);
      } catch (error) {
        stats.failedSends += 1;
        stats.sendLatencies.push(performance.now() - started);
        throw error;
      }
    },

    async flush(): Promise<void> {
      await baseTransport.flush();
    },

    async shutdown(): Promise<void> {
      await baseTransport.shutdown();
    },

    reset(): void {
      stats = createEmptyStats(options.measureEnvelopeBytes ?? false);
    },

    snapshot(): TransportProbeSnapshot {
      return {
        envelopesSent: stats.envelopesSent,
        recordsSent: stats.recordsSent,
        failedSends: stats.failedSends,
        ...(typeof stats.bytesSent === "number" ? { bytesSent: stats.bytesSent } : {}),
        sendLatencyMs: summarizeDistribution(stats.sendLatencies),
        addressContext: finalizeAddressContextCoverage(stats.addressContext),
      };
    },
  };
}

export function summarizeEnvelopes(
  envelopes: readonly TransmissionEnvelope[],
  options: ProbeTransportOptions = {},
): Omit<TransportProbeSnapshot, "sendLatencyMs" | "failedSends"> & {
  addressContext: AddressContextCoverage;
} {
  const stats = createEmptyStats(options.measureEnvelopeBytes ?? false);
  for (const envelope of envelopes) {
    applyEnvelopeStats(stats, envelope);
  }

  return {
    envelopesSent: stats.envelopesSent,
    recordsSent: stats.recordsSent,
    ...(typeof stats.bytesSent === "number" ? { bytesSent: stats.bytesSent } : {}),
    addressContext: finalizeAddressContextCoverage(stats.addressContext),
  };
}

export function summarizeDistribution(values: readonly number[]): DistributionSummary {
  if (values.length === 0) {
    return { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const sum = sorted.reduce((acc, value) => acc + value, 0);

  return {
    min: roundMetric(sorted[0] ?? 0),
    avg: roundMetric(sum / sorted.length),
    p50: roundMetric(percentile(sorted, 0.5)),
    p95: roundMetric(percentile(sorted, 0.95)),
    p99: roundMetric(percentile(sorted, 0.99)),
    max: roundMetric(sorted[sorted.length - 1] ?? 0),
  };
}

function createEmptyStats(measureEnvelopeBytes: boolean): MutableTransportStats {
  return {
    envelopesSent: 0,
    recordsSent: 0,
    failedSends: 0,
    ...(measureEnvelopeBytes ? { bytesSent: 0 } : {}),
    sendLatencies: [],
    addressContext: {
      totalRecords: 0,
      recordsWithAddressContext: 0,
      prefixes: {},
    },
  };
}

function applyEnvelopeStats(
  stats: MutableTransportStats,
  envelope: TransmissionEnvelope,
): void {
  stats.envelopesSent += 1;
  stats.recordsSent += envelope.records.length;
  if (typeof stats.bytesSent === "number") {
    stats.bytesSent += new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
  }

  for (const record of envelope.records) {
    stats.addressContext.totalRecords += 1;
    const merged = {
      ...(envelope.infra_context ?? {}),
      ...(record.address_context ?? {}),
    };
    const prefixes = Object.keys(merged);
    if (prefixes.length === 0) continue;
    stats.addressContext.recordsWithAddressContext += 1;
    for (const prefixId of prefixes) {
      stats.addressContext.prefixes[prefixId] =
        (stats.addressContext.prefixes[prefixId] ?? 0) + 1;
    }
  }
}

function finalizeAddressContextCoverage(
  coverage: MutableAddressContextCoverage,
): AddressContextCoverage {
  return {
    totalRecords: coverage.totalRecords,
    recordsWithAddressContext: coverage.recordsWithAddressContext,
    prefixes: { ...coverage.prefixes },
    uniquePrefixes: Object.keys(coverage.prefixes).sort(),
  };
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil(sortedValues.length * ratio) - 1;
  return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, index))] ?? 0;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}
