import { Hono } from "hono";
import {
  transmissionEnvelopeSchema,
  type TransmissionEnvelope,
  type RecordInsert,
  type RecordStore,
  type TraceStore,
  type TransmissionStore,
  type SessionStore,
} from "@qa-sdk/core";

export interface IngestDeps {
  recordStore: RecordStore;
  traceStore: TraceStore;
  transmissionStore: TransmissionStore;
  sessionStore: SessionStore;
}

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
  // 1. transmission 메타 저장
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

  // 2. trace별 그룹핑
  const traceGroups = new Map<string, typeof envelope.records>();
  for (const r of envelope.records) {
    const group = traceGroups.get(r.trace_id);
    if (group) group.push(r);
    else traceGroups.set(r.trace_id, [r]);
  }

  // 3. trace 메타 upsert + session upsert + record 저장
  for (const [traceId, records] of traceGroups) {
    const timestamps = records.map((r) => new Date(r.timestamp));
    const first = new Date(Math.min(...timestamps.map((d) => d.getTime())));
    const last = new Date(Math.max(...timestamps.map((d) => d.getTime())));

    const sessionId = records.find((r) => r.qa_session_id)?.qa_session_id;

    await deps.traceStore.upsert({
      traceId,
      sessionId,
      serviceName: envelope.source.service_name,
      recordCount: records.length,
      firstTimestamp: first,
      lastTimestamp: last,
    });

    if (sessionId) {
      await deps.sessionStore.upsert({ sessionId });
    }

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
    }));

    await deps.recordStore.insertBatch(inserts);
  }
}
