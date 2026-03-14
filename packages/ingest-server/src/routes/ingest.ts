import { Hono } from "hono";
import {
  type GraphStore,
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
} from "@qa-sdk/core";
import { reconstructPendingTraces, computePendingVerdicts } from "@qa-sdk/engine";
import type { ValidationResult } from "@qa-sdk/registry-client";
import type { RecordStreamBroker } from "../lib/record-stream-broker.js";
import type { Logger } from "pino";
import { badRequest } from "../lib/errors.js";

export type RegistryValidationMode = "strict" | "warn" | "off";

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
  registryValidationMode?: RegistryValidationMode;
  registryValidator?: RegistryEventValidator;
  withTraceTransaction?: TraceTransactionRunner;
  logger?: Logger;
}

export interface TracePersistenceStores {
  recordStore: Pick<RecordStore, "insertBatch">;
  traceStore: Pick<TraceStore, "upsert">;
  sessionStore: Pick<SessionStore, "upsert">;
}

export type TraceTransactionRunner = <T>(
  fn: (stores: TracePersistenceStores) => Promise<T>,
) => Promise<T>;

export function createIngestRoutes(deps: IngestDeps) {
  const app = new Hono();

  app.post("/v1/ingest", async (c) => {
    const body = await c.req.json();
    const parsed = transmissionEnvelopeSchema.parse(body);
    const envelope = parsed as TransmissionEnvelope;

    await processEnvelope(envelope, deps);

    return c.json({ accepted: true, record_count: envelope.records.length }, 202);
  });

  return app;
}

async function processEnvelope(
  envelope: TransmissionEnvelope,
  deps: IngestDeps,
) {
  // Phase 1: 저장 (응답 경로)
  await storeEnvelope(envelope, deps);

  // TODO: Phase 2는 현재 HTTP 응답 전에 동기로 실행된다.
  // 트래픽이 늘어나면 메시지 큐(e.g. BullMQ, SQS)로 분리해야 한다.
  // 분리 시 Phase 1 완료 후 즉시 202를 반환하고, Phase 2는 워커가 처리한다.
  await postIngestProcess(deps);
}

/** Phase 1: transmission 메타 + trace/session/record 저장 + SSE 발행 */
async function storeEnvelope(
  envelope: TransmissionEnvelope,
  deps: IngestDeps,
) {
  const registryWarnings = await validateEnvelopeRecords(envelope, deps);

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
      new Set(
        records.flatMap((record) =>
          record.qa_session_id ? [record.qa_session_id] : [],
        ),
      ),
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
      for (const record of storedRecords) {
        deps.recordStreamBroker.publish(record);
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
    } catch (error) {
      deps.logger?.error(
        {
          err: error,
          traceId,
        },
        "failed to store trace",
      );
    }
  }
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
    deps.withTraceTransaction === undefined
      ? getTracePersistenceStores(deps)
      : undefined;

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

  await deps.withTraceTransaction!(persist);
}

async function validateEnvelopeRecords(
  envelope: TransmissionEnvelope,
  deps: IngestDeps,
): Promise<Map<string, string>> {
  const mode = deps.registryValidationMode ?? "warn";
  const validator = deps.registryValidator;

  if (mode === "off" || validator === undefined) {
    return new Map();
  }

  const serviceName = envelope.source.service_name;
  const uniqueEventKeys = new Map<
    string,
    { eventKey: string; eventVersion: string }
  >();

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
    const result = validationResults.get(
      getEventIdentity(record.event_key, record.event_version),
    );

    if (!result || result.valid) {
      return [];
    }

    return [
      {
        eventKey: record.event_key,
        eventVersion: record.event_version,
        logId: record.log_id,
        reason: result.reason ?? "event not found in registry",
      },
    ];
  });

  if (invalidRecords.length === 0) {
    return new Map();
  }

  if (mode === "strict") {
    throw badRequest(
      `registry validation failed for ${invalidRecords
        .map((record) => formatInvalidRegistryEvent(record))
        .join(", ")}`,
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
    "ingest payload contains unregistered events",
  );

  return new Map(
    invalidRecords.map((record) => [record.logId, record.reason] as const),
  );
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
    return await validator.validateEvent(
      event.serviceName,
      event.eventKey,
      event.eventVersion,
    );
  } catch (error) {
    deps.logger?.warn(
      {
        err: error,
        eventKey: event.eventKey,
        eventVersion: event.eventVersion,
        serviceName: event.serviceName,
      },
      "registry validation unavailable, failing open",
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

/** Phase 2: reconstruction + verdict 계산 */
async function postIngestProcess(deps: IngestDeps) {
  const reconstructResult = await reconstructPendingTraces(
    {
      recordStore: deps.recordStore,
      traceStore: deps.traceStore,
      graphStore: deps.graphStore,
      dlqStore: deps.dlqStore,
    },
    {
      onError: (traceId, error) => {
        deps.logger?.error(
          {
            err: error,
            traceId,
          },
          "failed to reconstruct trace",
        );
      },
    },
  );

  if (reconstructResult.reconstructedTraceIds.length > 0) {
    await computePendingVerdicts(
      {
        traceStore: deps.traceStore,
        sessionStore: deps.sessionStore,
        graphStore: deps.graphStore,
        scenarioSpecStore: deps.scenarioSpecStore,
        verdictStore: deps.verdictStore,
        dlqStore: deps.dlqStore,
      },
      reconstructResult.reconstructedTraceIds,
      {
        onError: (traceId, error) => {
          deps.logger?.error(
            {
              err: error,
              traceId,
            },
            "failed to compute verdict",
          );
        },
      },
    );
  }
}

function toStoredRecords(records: RecordInsert[]): StoredRecord[] {
  return records.map((record) => ({
    ...structuredClone(record),
    createdAt: new Date(),
  }));
}
