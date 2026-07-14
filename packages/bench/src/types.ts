import type { MetricType, QaLoggerConfig, TransmissionEnvelope, Transport } from '@qa-sdk/sdk';
import type { Catalog, PrefixIds, ServiceBootConfig } from '@qa-sdk/core';

export interface BenchmarkClient {
  startSession(
    scenarioId?: string,
    existingSessionId?: string,
  ): { traceId: string; sessionId: string };
  emitEvent(
    eventKey: string,
    payload?: Record<string, unknown>,
    options?: { eventVersion?: string; address_context?: Record<string, string> },
  ): void;
  emitMetric(
    name: string,
    value: number,
    options?: {
      type?: MetricType;
      unit?: string;
      labels?: Record<string, string>;
      address_context?: Record<string, string>;
    },
  ): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface BenchmarkBridge extends BenchmarkClient {
  readonly transportMode?: string;
  getDebugEnvelopes?(): readonly TransmissionEnvelope[];
}

export interface BenchmarkCounters {
  sessionsStarted: number;
  eventsEmitted: number;
  metricsEmitted: number;
  flushCalls: number;
}

export interface BenchmarkErrorSummary {
  total: number;
  byContext: Record<string, number>;
}

export interface BenchmarkWorkerSnapshot {
  counters: BenchmarkCounters;
  transport?: TransportProbeSnapshot;
  errors?: BenchmarkErrorSummary;
}

export interface BenchmarkHarness {
  readonly client: BenchmarkClient;
  reset(): Promise<void> | void;
  snapshot(): BenchmarkWorkerSnapshot;
}

export interface DistributionSummary {
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface TransportProbeSnapshot {
  envelopesSent: number;
  recordsSent: number;
  failedSends: number;
  bytesSent?: number;
  sendLatencyMs: DistributionSummary;
  addressContext?: AddressContextCoverage;
}

export interface BenchmarkIterationContext {
  client: BenchmarkClient;
  workerId: number;
  iteration: number;
  phase: 'warmup' | 'measure';
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  run(context: BenchmarkIterationContext): Promise<void>;
}

export type ScenarioValue<T> = T | ((context: BenchmarkIterationContext) => T);

export interface ScenarioSessionStep {
  kind: 'session';
  scenarioId?: ScenarioValue<string | undefined>;
  existingSessionId?: ScenarioValue<string | undefined>;
}

export interface ScenarioEventStep {
  kind: 'event';
  eventKey: ScenarioValue<string>;
  payload?: ScenarioValue<Record<string, unknown> | undefined>;
  eventVersion?: ScenarioValue<string | undefined>;
  addressContext?: ScenarioValue<Record<string, string> | undefined>;
}

export interface ScenarioMetricStep {
  kind: 'metric';
  name: ScenarioValue<string>;
  value: ScenarioValue<number>;
  type?: ScenarioValue<MetricType | undefined>;
  unit?: ScenarioValue<string | undefined>;
  labels?: ScenarioValue<Record<string, string> | undefined>;
  addressContext?: ScenarioValue<Record<string, string> | undefined>;
}

export interface ScenarioFlushStep {
  kind: 'flush';
}

export interface ScenarioWaitStep {
  kind: 'wait';
  durationMs: ScenarioValue<number>;
}

export type SequenceScenarioStep =
  | ScenarioSessionStep
  | ScenarioEventStep
  | ScenarioMetricStep
  | ScenarioFlushStep
  | ScenarioWaitStep;

export interface SequenceScenarioConfig {
  id: string;
  name: string;
  steps: readonly SequenceScenarioStep[];
}

export interface BenchmarkRunConfig {
  scenario: BenchmarkScenario;
  harnessFactory(workerId: number): BenchmarkHarness | Promise<BenchmarkHarness>;
  concurrency?: number;
  warmupIterations?: number;
  measuredIterations: number;
}

export interface BenchmarkRunSummary {
  scenarioId: string;
  scenarioName: string;
  concurrency: number;
  warmupIterations: number;
  measuredIterations: number;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  scenarioLatencyMs: DistributionSummary;
  scenarioRate: number;
  counters: BenchmarkCounters;
  transport?: TransportProbeSnapshot;
  errors?: BenchmarkErrorSummary;
}

export interface QaLoggerBenchmarkHarnessConfig extends QaLoggerConfig {
  measureEnvelopeBytes?: boolean;
}

export interface ProbeTransportOptions {
  measureEnvelopeBytes?: boolean;
}

export interface BridgeEnvelopeDelta {
  envelopesSent: number;
  recordsSent: number;
  bytesSent?: number;
}

export interface ProbeTransport extends Transport {
  reset(): void;
  snapshot(): TransportProbeSnapshot;
}

export interface AddressContextCoverage {
  totalRecords: number;
  recordsWithAddressContext: number;
  prefixes: Record<string, number>;
  uniquePrefixes: string[];
}

export interface BenchmarkQaContext<C extends Catalog = Catalog> {
  infraContext(): Record<string, string>;
  track(
    prefixes: Partial<Record<PrefixIds<C>, Record<string, string | number>>>,
  ): Record<string, string>;
}

export interface BenchmarkQaContextConfig<C extends Catalog = Catalog> {
  catalog: C;
  serviceConfig: ServiceBootConfig;
}

export interface BenchmarkReportOptions {
  format?: 'text' | 'markdown';
  title?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export interface ScenarioPresetOptions<C extends Catalog = Catalog> {
  qaContext?: BenchmarkQaContext<C>;
  locale?: string;
  userType?: string;
  flowVariant?: string;
}
