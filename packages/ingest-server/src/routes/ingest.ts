// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from 'hono';
import {
  CodecContractError,
  type GraphStore,
  type TaskPayload,
  type TaskQueue,
  transmissionEnvelopeSchema,
  type TransmissionEnvelope,
  type RecordInsert,
  type RecordStore,
  type ScenarioSpecStore,
  type StoredRecord,
  type TraceStore,
  type TransmissionStore,
  type SessionStore,
  type VerdictStore,
  type DlqStore,
  type KeyObservationStore,
} from '@qa-sdk/core';
import type { ValidationResult } from '@qa-sdk/registry-client';
import type { RecordStreamBroker } from '../lib/record-stream-broker.js';
import { createNoopDebugStore, type DebugStore } from '../lib/debug-store.js';
import type { Logger } from 'pino';
import { badRequest } from '../lib/errors.js';
import { enrichAddressContext, checkAddressHealth } from '../lib/enrich-address-context.js';
import type { SnapshotGate } from '../lib/snapshot-gate.js';
import {
  buildReconstructionTask,
  PHASE_TWO_TASK_QUEUE_OPTIONS,
  processPendingPhaseTwo,
  type ConvergencePipelinePort,
  type TransitionEnginePort,
} from '../lib/phase-two-worker.js';
import type { CatalogValidator } from '../lib/catalog-validator.js';
import type { MetricsCollector } from '../lib/metrics-collector.js';
import { extractKeyObservations } from '../lib/extract-key-observations.js';

export type RegistryValidationMode = 'strict' | 'warn' | 'off';

export interface RegistryEventValidator {
  validateEvent(
    serviceName: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<ValidationResult>;
}

export interface IngestDeps {
  recordStore: RecordStore;
  traceStore: TraceStore;
  graphStore: GraphStore;
  transmissionStore: TransmissionStore;
  sessionStore: SessionStore;
  verdictStore: VerdictStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
  recordStreamBroker: RecordStreamBroker;
  debugStore?: DebugStore;
  registryValidationMode?: RegistryValidationMode;
  registryValidator?: RegistryEventValidator;
  withTraceTransaction?: TraceTransactionRunner;
  taskQueue?: TaskQueue<TaskPayload>;
  convergencePipeline?: ConvergencePipelinePort;
  /** Phase 2.5 transition engine (inline 경로, transitionCatalog와 함께 필요) */
  transitionEngine?: TransitionEnginePort;
  transitionCatalog?: unknown;
  /** decode-service URL — transition 입력 address_context 디코딩 */
  decodeServiceUrl?: string;
  metricsCollector?: Pick<MetricsCollector, 'inc' | 'increment'>;
  logger?: Logger;
  /** 건전성 검증용 prefix 메타 (설정 시 address_context 건전성 검증 활성화) */
  knownPrefixes?: ReadonlySet<string>;
  latestVersions?: ReadonlyMap<string, string>;
  /** 카탈로그 기반 event/prefix 검증 (fail-open) */
  catalogValidator?: CatalogValidator;
  /** InsightsStore — 수집된 데이터를 인사이트 저장소에 전달 (app-hub 모드) */
  insightsStore?: import('../ports/insights-store.port.js').InsightsStore;
  /** Key Observation — packed_key 관측 영속 기록 (fail-open) */
  keyObservationStore?: KeyObservationStore;
  /** envelope catalog_snapshot 판정 (Track B). 미설정이면 판정하지 않음 */
  snapshotGate?: SnapshotGate;
}

export interface TracePersistenceStores {
  recordStore: Pick<RecordStore, 'insertBatch'>;
  traceStore: Pick<TraceStore, 'upsert'>;
  sessionStore: Pick<SessionStore, 'upsert'>;
}

export type TraceTransactionRunner = <T>(
  fn: (stores: TracePersistenceStores) => Promise<T>,
) => Promise<T>;

/** Content-Type 기반 디시리얼라이즈. JSON/Protobuf/MessagePack 지원. */
async function deserializeEnvelope(c: {
  req: {
    header(name: string): string | undefined;
    json(): Promise<unknown>;
    arrayBuffer(): Promise<ArrayBuffer>;
  };
}): Promise<TransmissionEnvelope> {
  const ct = c.req.header('content-type') ?? 'application/json';

  if (ct.includes('application/x-protobuf') || ct.includes('application/protobuf')) {
    const buf = await c.req.arrayBuffer();
    const bytes = new Uint8Array(buf);

    // QAPB 프레이밍 감지 (magic: 0x51 0x41 0x50 0x42)
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x51 &&
      bytes[1] === 0x41 &&
      bytes[2] === 0x50 &&
      bytes[3] === 0x42
    ) {
      const { fromProtoEnvelope } = await import('../lib/proto-codec.js');
      const raw = fromProtoEnvelope(bytes);
      return transmissionEnvelopeSchema.parse(raw) as TransmissionEnvelope;
    }

    // 진짜 Protobuf 바이너리 (codec-proto). JSON fallback은 모듈 로드 실패일 때만 —
    // decode 오류(CorruptEnvelope)는 JSON으로 다시 해석하지 않고 그대로 400으로 보낸다
    let decodeEnvelope: typeof import('@qa-sdk/codec-proto').decodeEnvelope | undefined;
    try {
      ({ decodeEnvelope } = await import('@qa-sdk/codec-proto'));
    } catch {
      const text = new TextDecoder().decode(bytes);
      return transmissionEnvelopeSchema.parse(JSON.parse(text)) as TransmissionEnvelope;
    }
    // proto 경로도 JSON과 같은 스키마 검증을 거친다 (필드 경계에서 잘린 메시지 포함)
    return transmissionEnvelopeSchema.parse(decodeEnvelope(bytes)) as TransmissionEnvelope;
  }

  if (ct.includes('application/msgpack') || ct.includes('application/x-msgpack')) {
    const { decode } = await import('@msgpack/msgpack');
    const buf = await c.req.arrayBuffer();
    const raw = decode(new Uint8Array(buf));
    return transmissionEnvelopeSchema.parse(raw) as TransmissionEnvelope;
  }

  // Default: application/json
  const body = await c.req.json();
  return transmissionEnvelopeSchema.parse(body) as TransmissionEnvelope;
}

export function createIngestRoutes(deps: IngestDeps) {
  const app = new Hono();

  app.post('/v1/ingest', async (c) => {
    try {
      const envelope = await deserializeEnvelope(c);
      await processEnvelope(envelope, deps);
      deps.metricsCollector?.inc('ingest_requests_total', { status: '202' });
      deps.metricsCollector?.inc('ingest_records_total', {}, envelope.records.length);
      return c.json({ accepted: true, record_count: envelope.records.length }, 202);
    } catch (err) {
      deps.metricsCollector?.inc('ingest_requests_total', { status: '500' });
      throw err;
    }
  });

  return app;
}

async function processEnvelope(envelope: TransmissionEnvelope, deps: IngestDeps) {
  // Phase 1: 저장 (응답 경로)
  const persistedTraceIds = await storeEnvelope(envelope, deps);

  // InsightsStore collect — 외부 저장소 드라이버(app-hub)만 구현한다. local 모드는 batch를 만들지 않는다
  if (deps.insightsStore?.collect) {
    try {
      await deps.insightsStore.collect({
        records: envelope.records.map((r) => ({
          logId: r.log_id,
          timestamp: r.timestamp,
          traceId: r.trace_id,
          eventKey: r.event_key,
          eventVersion: r.event_version,
          recordKind: r.record_kind,
          addressContext: r.address_context,
          payload: r.payload as Record<string, unknown> | undefined,
          actorId: r.actor_id,
          userId: r.user_id,
          qaSessionId: r.qa_session_id,
        })),
        traces: (() => {
          // traceId별 record 수를 O(N)으로 집계 (filter 반복 O(N*M) 방지)
          const counts = new Map<string, number>();
          for (const r of envelope.records)
            counts.set(r.trace_id, (counts.get(r.trace_id) ?? 0) + 1);
          return persistedTraceIds.map((traceId) => ({
            traceId,
            serviceName: envelope.source.service_name,
            recordCount: counts.get(traceId) ?? 0,
          }));
        })(),
        sessions: [...new Set(envelope.records.map((r) => r.qa_session_id).filter(Boolean))].map(
          (sid) => ({
            sessionId: sid!,
            startedAt: envelope.sent_at,
          }),
        ),
      });
    } catch (err) {
      // fail-open: insights 전달 실패가 ingest를 차단하지 않음
      deps.logger?.warn({ err }, 'insights collect failed — skipped');
    }
  }

  if (deps.taskQueue) {
    await enqueuePhaseTwoTasks(persistedTraceIds, deps.taskQueue);
    return;
  }

  await processPendingPhaseTwo(deps);
}

/** Phase 1: transmission 메타 + trace/session/record 저장 + SSE 발행 */
/** snapshot gate 판정 결과 counter (label: result, code) */
export const SNAPSHOT_GATE_METRIC = 'snapshot_gate_total';

/** 상태·SDK 조합별 경고를 프로세스당 한 번만 남긴다 (요청마다 로그 폭주 방지) */
const warnedGateKeys = new WeakMap<SnapshotGate, Set<string>>();

/** snapshot gate 판정. enforce 모드의 계약 위반은 CodecContractError(422)로 거부한다 */
async function applySnapshotGate(envelope: TransmissionEnvelope, deps: IngestDeps): Promise<void> {
  const gate = deps.snapshotGate;
  if (!gate) return;
  const result = await gate.check(envelope);
  deps.metricsCollector?.increment(SNAPSHOT_GATE_METRIC, {
    result: result.status,
    ...(result.status === 'violation' ? { code: result.code } : {}),
  });
  if (result.status === 'ok') return;
  if (result.status === 'violation' && gate.mode === 'enforce') {
    throw new CodecContractError(result.code, result.message, {
      transmissionId: envelope.transmission_id,
    });
  }
  const warned = warnedGateKeys.get(gate) ?? new Set<string>();
  warnedGateKeys.set(gate, warned);
  const key = `${result.status}:${result.status === 'violation' ? result.code : ''}:${envelope.source.sdk_name}`;
  if (warned.has(key)) return;
  warned.add(key);
  deps.logger?.warn(
    { gate: result, sdk: envelope.source.sdk_name, mode: gate.mode },
    'snapshot gate: 좌표 문맥을 확인할 수 없거나 계약 위반 (이 조합은 이후 경고 생략)',
  );
}

async function storeEnvelope(envelope: TransmissionEnvelope, deps: IngestDeps): Promise<string[]> {
  await applySnapshotGate(envelope, deps);

  // address context 머지: infra_context(base) ← record.address_context(override)
  enrichAddressContext(envelope, envelope.records);

  // address context 건전성 검증 (설정 시)
  if (deps.knownPrefixes && deps.latestVersions) {
    const health = checkAddressHealth(envelope.records, deps.knownPrefixes, deps.latestVersions);
    if (health.orphanPrefixes.length > 0) {
      deps.logger?.warn(
        { orphans: health.orphanPrefixes, healthRate: health.healthRate },
        'address_context orphan prefixes detected',
      );
    }
    if (health.staleVersions.length > 0) {
      deps.logger?.warn({ stale: health.staleVersions }, 'address_context stale versions detected');
    }
  }

  // 카탈로그 기반 event/prefix 검증 (fail-open)
  if (deps.catalogValidator) {
    validateWithCatalog(envelope, deps.catalogValidator, deps.logger);
  }

  const registryWarnings = await validateEnvelopeRecords(envelope, deps);
  const persistedTraceIds: string[] = [];

  await deps.transmissionStore.insert({
    transmissionId: envelope.transmission_id,
    sentAt: new Date(envelope.sent_at),
    ownerType: envelope.owner.owner_type,
    ownerId: envelope.owner.owner_id,
    serviceName: envelope.source.service_name,
    sdkName: envelope.source.sdk_name,
    sdkVersion: envelope.source.sdk_version,
    platform: envelope.runtime.platform,
    env: envelope.build.env,
    recordCount: envelope.records.length,
  });

  const traceGroups = new Map<string, typeof envelope.records>();
  for (const r of envelope.records) {
    const group = traceGroups.get(r.trace_id);
    if (group) group.push(r);
    else traceGroups.set(r.trace_id, [r]);
  }

  for (const [traceId, records] of traceGroups) {
    const timestamps = records.map((r) => new Date(r.timestamp));
    const first = new Date(Math.min(...timestamps.map((d) => d.getTime())));
    const last = new Date(Math.max(...timestamps.map((d) => d.getTime())));

    const sessionIds = Array.from(
      new Set(records.flatMap((record) => (record.qa_session_id ? [record.qa_session_id] : []))),
    );
    const sessionId = sessionIds[0];

    const inserts: RecordInsert[] = records.map((r) => ({
      logId: r.log_id,
      traceId: r.trace_id,
      spanId: r.span_id,
      parentSpanId: r.parent_span_id,
      timestamp: new Date(r.timestamp),
      recordKind: r.record_kind,
      eventKey: r.event_key,
      eventVersion: r.event_version,
      spanName: r.span_name,
      startTime: r.start_time ? new Date(r.start_time) : undefined,
      endTime: r.end_time ? new Date(r.end_time) : undefined,
      statusCode: r.status_code,
      payloadFormat: r.payload_format,
      payloadEncoding: r.payload_encoding,
      payloadMaskingApplied: r.payload_masking_applied,
      payloadMaskedFields: r.payload_masked_fields,
      payload: r.payload,
      qaSessionId: r.qa_session_id,
      registryWarning: registryWarnings.get(r.log_id),
      addressContext: r.address_context,
      metricType: r.metric_type,
      metricName: r.metric_name,
      metricValue: r.metric_value,
      metricUnit: r.metric_unit,
      metricLabels: r.metric_labels,
      metricBuckets: r.metric_buckets,
      metricQuantiles: r.metric_quantiles,
      actorId: r.actor_id,
      userId: r.user_id,
      userAttributes: r.user_attributes,
    }));

    // actor 컨텍스트: 레코드 중 첫 번째로 actor_id가 있는 것을 trace/session에 전파
    const actorRecord = records.find((r) => r.actor_id);
    const actorId = actorRecord?.actor_id;
    const userId = actorRecord?.user_id;
    const userAttributes = actorRecord?.user_attributes;

    try {
      await persistTrace(
        {
          traceId,
          sessionId,
          sessionIds,
          serviceName: envelope.source.service_name,
          recordCount: records.length,
          firstTimestamp: first,
          lastTimestamp: last,
          records: inserts,
          actorId,
          userId,
          userAttributes,
        },
        deps,
      );

      const storedRecords = toStoredRecords(inserts);
      const debugStore = resolveDebugStore(deps);
      for (const record of storedRecords) {
        deps.recordStreamBroker.publish(record);
        await debugStore.append(record).catch((error) => {
          deps.logger?.warn(
            {
              err: error,
              logId: record.logId,
              traceId,
            },
            'failed to append record to debug store',
          );
        });
      }

      // scenario-level broadcast for WebSocket subscribers
      if (sessionId && deps.recordStreamBroker.hasScenarioSubscribers()) {
        const session = await deps.sessionStore.findById(sessionId).catch(() => null);
        if (session?.scenarioId) {
          for (const record of storedRecords) {
            deps.recordStreamBroker.publishToScenario(session.scenarioId, record);
          }
        }
      }

      // Key observation — packed_key 관측 기록 (fail-open)
      if (deps.keyObservationStore) {
        try {
          const observations = extractKeyObservations(inserts, deps.knownPrefixes);
          if (observations.length > 0) {
            await deps.keyObservationStore.observeBatch(observations);
          }
        } catch (err) {
          deps.logger?.warn({ err }, 'key observation failed — fail-open');
        }
      }

      persistedTraceIds.push(traceId);
    } catch (error) {
      deps.logger?.error(
        {
          err: error,
          traceId,
        },
        'failed to store trace',
      );
    }
  }

  return persistedTraceIds;
}

async function persistTrace(
  trace: {
    traceId: string;
    sessionId?: string;
    sessionIds: string[];
    serviceName: string;
    recordCount: number;
    firstTimestamp: Date;
    lastTimestamp: Date;
    records: RecordInsert[];
    actorId?: string;
    userId?: string;
    userAttributes?: Record<string, string>;
  },
  deps: IngestDeps,
) {
  const stores =
    deps.withTraceTransaction === undefined ? getTracePersistenceStores(deps) : undefined;

  const persist = async (transactionStores: TracePersistenceStores) => {
    for (const sessionId of trace.sessionIds) {
      await transactionStores.sessionStore.upsert({
        sessionId,
        actorId: trace.actorId,
        userId: trace.userId,
        userAttributes: trace.userAttributes,
      });
    }

    await transactionStores.traceStore.upsert({
      traceId: trace.traceId,
      sessionId: trace.sessionId,
      serviceName: trace.serviceName,
      recordCount: trace.recordCount,
      firstTimestamp: trace.firstTimestamp,
      lastTimestamp: trace.lastTimestamp,
      actorId: trace.actorId,
      userId: trace.userId,
      userAttributes: trace.userAttributes,
    });

    await transactionStores.recordStore.insertBatch(trace.records);
  };

  if (stores) {
    await persist(stores);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- stores가 undefined이면 withTraceTransaction이 반드시 존재 (L320-322 불변조건)
  await deps.withTraceTransaction!(persist);
}

async function validateEnvelopeRecords(
  envelope: TransmissionEnvelope,
  deps: IngestDeps,
): Promise<Map<string, string>> {
  const mode = deps.registryValidationMode ?? 'warn';
  const validator = deps.registryValidator;

  if (mode === 'off' || validator === undefined) {
    return new Map();
  }

  const serviceName = envelope.source.service_name;
  const uniqueEventKeys = new Map<string, { eventKey: string; eventVersion: string }>();

  for (const record of envelope.records) {
    const eventIdentity = getEventIdentity(record.event_key, record.event_version);
    if (!uniqueEventKeys.has(eventIdentity)) {
      uniqueEventKeys.set(eventIdentity, {
        eventKey: record.event_key,
        eventVersion: record.event_version,
      });
    }
  }

  const validationResults = new Map<string, ValidationResult>();
  await Promise.all(
    Array.from(uniqueEventKeys.entries()).map(async ([eventIdentity, event]) => {
      validationResults.set(
        eventIdentity,
        await validateRegistryEvent(
          validator,
          {
            serviceName,
            ...event,
          },
          deps,
        ),
      );
    }),
  );

  const invalidRecords = envelope.records.flatMap((record) => {
    const result = validationResults.get(getEventIdentity(record.event_key, record.event_version));

    if (!result || result.valid) {
      return [];
    }

    return [
      {
        eventKey: record.event_key,
        eventVersion: record.event_version,
        logId: record.log_id,
        reason: result.reason ?? 'event not found in registry',
      },
    ];
  });

  if (invalidRecords.length === 0) {
    return new Map();
  }

  if (mode === 'strict') {
    throw badRequest(
      `registry validation failed for ${invalidRecords
        .map((record) => formatInvalidRegistryEvent(record))
        .join(', ')}`,
    );
  }

  deps.logger?.warn(
    {
      invalidEvents: invalidRecords.map((record) => ({
        eventKey: record.eventKey,
        eventVersion: record.eventVersion,
        logId: record.logId,
        reason: record.reason,
      })),
      serviceName,
    },
    'ingest payload contains unregistered events',
  );

  return new Map(invalidRecords.map((record) => [record.logId, record.reason] as const));
}

async function validateRegistryEvent(
  validator: RegistryEventValidator,
  event: {
    serviceName: string;
    eventKey: string;
    eventVersion: string;
  },
  deps: IngestDeps,
): Promise<ValidationResult> {
  try {
    return await validator.validateEvent(event.serviceName, event.eventKey, event.eventVersion);
  } catch (error) {
    deps.logger?.warn(
      {
        err: error,
        eventKey: event.eventKey,
        eventVersion: event.eventVersion,
        serviceName: event.serviceName,
      },
      'registry validation unavailable, failing open',
    );
    return { valid: true };
  }
}

function getEventIdentity(eventKey: string, eventVersion: string): string {
  return JSON.stringify([eventKey, eventVersion]);
}

function formatInvalidRegistryEvent(record: {
  eventKey: string;
  eventVersion: string;
  reason: string;
}): string {
  return `${record.eventKey}@${record.eventVersion} (${record.reason})`;
}

function getTracePersistenceStores(deps: IngestDeps): TracePersistenceStores {
  return {
    recordStore: deps.recordStore,
    traceStore: deps.traceStore,
    sessionStore: deps.sessionStore,
  };
}

function resolveDebugStore(deps: IngestDeps): DebugStore {
  return deps.debugStore ?? createNoopDebugStore();
}

async function enqueuePhaseTwoTasks(traceIds: string[], taskQueue: TaskQueue<TaskPayload>) {
  for (const traceId of traceIds) {
    await taskQueue.enqueue(buildReconstructionTask(traceId), PHASE_TWO_TASK_QUEUE_OPTIONS);
  }
}

function toStoredRecords(records: RecordInsert[]): StoredRecord[] {
  return records.map((record) => ({
    ...structuredClone(record),
    createdAt: new Date(),
  }));
}

/**
 * 카탈로그 기반 eventKey/prefix 검증.
 * fail-open: 검증 실패해도 레코드는 통과시키고 warning만 기록한다.
 */
function validateWithCatalog(
  envelope: TransmissionEnvelope,
  validator: CatalogValidator,
  logger?: Logger,
): void {
  try {
    // ── eventKey 검증 (중복 제거) ──
    const unknownEventKeys = new Set<string>();
    for (const record of envelope.records) {
      const result = validator.validateEventKey(record.event_key);
      if (!result.known) {
        unknownEventKeys.add(record.event_key);
      }
    }

    if (unknownEventKeys.size > 0) {
      logger?.warn(
        {
          unknownEventKeys: [...unknownEventKeys],
          serviceName: envelope.source.service_name,
          recordCount: envelope.records.length,
        },
        '카탈로그에 미등록된 eventKey 감지 (fail-open)',
      );
    }

    // ── prefix 검증 (중복 제거) ──
    const allUnknownPrefixes = new Set<string>();
    for (const record of envelope.records) {
      const result = validator.validatePrefixes(record.address_context);
      for (const prefix of result.unknownPrefixes) {
        allUnknownPrefixes.add(prefix);
      }
    }

    if (allUnknownPrefixes.size > 0) {
      logger?.warn(
        {
          unknownPrefixes: [...allUnknownPrefixes],
          serviceName: envelope.source.service_name,
        },
        '카탈로그에 미등록된 prefix 감지 (fail-open)',
      );
    }
  } catch (error) {
    // 검증 자체의 실패도 fail-open
    logger?.warn({ err: error }, '카탈로그 검증 실패 — fail-open 통과');
  }
}
