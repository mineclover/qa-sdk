// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from 'hono';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from '@qa-sdk/store';
import type { StoredRecord, TaskPayload, TaskQueue, TransmissionEnvelope } from '@qa-sdk/core';
import { createErrorHandler } from '../middleware/error-handler.js';
import { createIngestRoutes } from './ingest.js';
import { PHASE_TWO_TASK_QUEUE_OPTIONS } from '../lib/phase-two-worker.js';
import type { DebugStore } from '../lib/debug-store.js';
import { RecordStreamBroker } from '../lib/record-stream-broker.js';
import type { RegistryEventValidator, RegistryValidationMode } from './ingest.js';

interface IngestTestDeps {
  recordStore: InMemoryRecordStore;
  traceStore: InMemoryTraceStore;
  graphStore: InMemoryGraphStore;
  transmissionStore: InMemoryTransmissionStore;
  sessionStore: InMemorySessionStore;
  verdictStore: InMemoryVerdictStore;
  scenarioSpecStore: InMemoryScenarioSpecStore;
  dlqStore: InMemoryDlqStore;
  recordStreamBroker: RecordStreamBroker;
  debugStore?: DebugStore;
  registryValidationMode?: RegistryValidationMode;
  registryValidator?: RegistryEventValidator;
  taskQueue?: TaskQueue<TaskPayload>;
}

function buildDeps(overrides: Partial<IngestTestDeps> = {}): IngestTestDeps {
  return {
    recordStore: new InMemoryRecordStore(),
    traceStore: new InMemoryTraceStore(),
    graphStore: new InMemoryGraphStore(),
    transmissionStore: new InMemoryTransmissionStore(),
    sessionStore: new InMemorySessionStore(),
    verdictStore: new InMemoryVerdictStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    dlqStore: new InMemoryDlqStore(),
    recordStreamBroker: new RecordStreamBroker(),
    ...overrides,
  };
}

function buildApp(overrides: Partial<IngestTestDeps> = {}) {
  const deps = buildDeps(overrides);
  const app = new Hono();
  app.onError(createErrorHandler(pino({ level: 'silent' })));
  app.route('/', createIngestRoutes(deps));
  return { app, deps };
}

function buildEnvelope(overrides: Partial<TransmissionEnvelope> = {}): TransmissionEnvelope {
  return {
    transmission_id: 'txm_test',
    sent_at: '2026-03-13T00:00:00.000Z',
    owner: { owner_type: 'workspace', owner_id: 'ws_1' },
    source: { service_name: 'web-app', sdk_name: 'qa-sdk-js', sdk_version: '0.1.0' },
    runtime: { platform: 'node' },
    build: { env: 'dev' },
    records: [buildRecord()],
    ...overrides,
  };
}

function buildRecord(overrides: Partial<TransmissionEnvelope['records'][0]> = {}) {
  return {
    log_id: 'log_001',
    timestamp: '2026-03-13T00:00:00.000Z',
    record_kind: 'log' as const,
    trace_id: 'trc_001',
    span_id: 'spn_001',
    event_key: 'page_view',
    event_version: '001',
    payload_format: 'json' as const,
    payload_encoding: 'raw' as const,
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: {},
    ...overrides,
  };
}

describe('POST /v1/ingest', () => {
  it('returns 202 accepted with record_count', async () => {
    const { app } = buildApp();
    const envelope = buildEnvelope();

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.record_count).toBe(1);
  });

  it('returns 400 for malformed body (schema validation failure)', async () => {
    const { app } = buildApp();
    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    });
    expect(res.status).toBe(400);
  });

  it('stores transmission metadata in Phase 1', async () => {
    const { app, deps } = buildApp();
    const envelope = buildEnvelope();

    await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    const records = await deps.recordStore.findByTraceId('trc_001');
    expect(records).toHaveLength(1);
    expect(records[0]?.eventKey).toBe('page_view');
  });

  it('creates a trace entry for the records in Phase 1', async () => {
    const { app, deps } = buildApp();
    const envelope = buildEnvelope();

    await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    const trace = await deps.traceStore.findById('trc_001');
    expect(trace).not.toBeNull();
    expect(trace?.recordCount).toBe(1);
  });

  it('groups records by trace_id and creates separate traces', async () => {
    const { app, deps } = buildApp();
    const envelope = buildEnvelope({
      records: [
        buildRecord({ log_id: 'log_001', trace_id: 'trc_001' }),
        buildRecord({ log_id: 'log_002', trace_id: 'trc_002' }),
      ],
    });

    await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    expect(await deps.traceStore.findById('trc_001')).not.toBeNull();
    expect(await deps.traceStore.findById('trc_002')).not.toBeNull();
  });

  it('publishes records to the SSE broker', async () => {
    const broker = new RecordStreamBroker();
    const publishSpy = vi.spyOn(broker, 'publish');
    const { app } = buildApp({ recordStreamBroker: broker });

    const envelope = buildEnvelope();
    await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    expect(publishSpy).toHaveBeenCalledOnce();
  });

  it('appends records to the debug store immediately after publish', async () => {
    const broker = new RecordStreamBroker();
    const calls: string[] = [];
    const debugStore: DebugStore = {
      append: vi.fn(async (record: StoredRecord) => {
        calls.push(`append:${record.logId}`);
      }),
      getRecentByTrace: vi.fn().mockResolvedValue([]),
      getRecentBySession: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(broker, 'publish').mockImplementation((record) => {
      calls.push(`publish:${record.logId}`);
    });

    const { app } = buildApp({
      debugStore,
      recordStreamBroker: broker,
    });

    await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEnvelope()),
    });

    expect(calls).toEqual(['publish:log_001', 'append:log_001']);
    expect(debugStore.append).toHaveBeenCalledOnce();
  });

  it('creates a session entry when qa_session_id is present in records', async () => {
    const { app, deps } = buildApp();
    const envelope = buildEnvelope({
      records: [buildRecord({ qa_session_id: 'qas_001' })],
    });

    await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    const session = await deps.sessionStore.findById('qas_001');
    expect(session).not.toBeNull();
    expect(session?.sessionId).toBe('qas_001');
  });

  it('enqueues reconstruction after Phase 1 and does not run Phase 2 inline when TaskQueue is injected', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const { app, deps } = buildApp({
      taskQueue: {
        close: vi.fn(),
        enqueue,
        process: vi.fn(),
      },
    });
    const envelope = buildEnvelope({
      records: [buildRecord({ qa_session_id: 'qas_001' })],
    });

    const response = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trc_001',
        phase: 'reconstruction',
      }),
      PHASE_TWO_TASK_QUEUE_OPTIONS,
    );
    await expect(deps.graphStore.findByTraceId('trc_001')).resolves.toBeNull();
    await expect(deps.verdictStore.findByTraceId('trc_001')).resolves.toEqual([]);
  });

  it('returns 400 for invalid event_version format (must be 3 digits)', async () => {
    const { app } = buildApp();
    const envelope = buildEnvelope({
      records: [buildRecord({ event_version: '1' })],
    });

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    expect(res.status).toBe(400);
  });

  describe('registry validation', () => {
    it('rejects the request in strict mode when event is invalid', async () => {
      const { app } = buildApp({
        registryValidationMode: 'strict',
        registryValidator: {
          validateEvent: vi.fn().mockResolvedValue({ valid: false, reason: 'event not found' }),
        },
      });

      const res = await app.request('/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEnvelope()),
      });
      expect(res.status).toBe(400);
    });

    it('accepts the request in warn mode even when event is invalid', async () => {
      const { app } = buildApp({
        registryValidationMode: 'warn',
        registryValidator: {
          validateEvent: vi.fn().mockResolvedValue({ valid: false, reason: 'event not found' }),
        },
      });

      const res = await app.request('/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEnvelope()),
      });
      expect(res.status).toBe(202);
    });

    it('accepts the request when the validator throws (fail open)', async () => {
      const { app } = buildApp({
        registryValidationMode: 'strict',
        registryValidator: {
          validateEvent: vi.fn().mockRejectedValue(new Error('registry unavailable')),
        },
      });

      const res = await app.request('/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEnvelope()),
      });
      expect(res.status).toBe(202);
    });

    it('skips validation entirely in off mode', async () => {
      const validator = { validateEvent: vi.fn() };
      const { app } = buildApp({
        registryValidationMode: 'off',
        registryValidator: validator,
      });

      await app.request('/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEnvelope()),
      });
      expect(validator.validateEvent).not.toHaveBeenCalled();
    });
  });
});

describe('POST /v1/ingest — actor context 전파', () => {
  const actor = {
    actor_id: 'usr_token_abc',
    user_id: 'kim@example.com',
    user_attributes: { age_group: '30s', tier: 'premium' },
  } as const;

  async function ingest(app: ReturnType<typeof buildApp>['app'], envelope: TransmissionEnvelope) {
    return app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
  }

  it('레코드의 actor_id가 StoredRecord에 저장된다', async () => {
    const { app, deps } = buildApp();

    await ingest(
      app,
      buildEnvelope({
        records: [
          buildRecord({
            actor_id: actor.actor_id,
            user_id: actor.user_id,
            user_attributes: actor.user_attributes,
          }),
        ],
      }),
    );

    const records = await deps.recordStore.findByTraceId('trc_001');
    expect(records).toHaveLength(1);
    expect(records[0]?.actorId).toBe(actor.actor_id);
    expect(records[0]?.userId).toBe(actor.user_id);
    expect(records[0]?.userAttributes).toEqual(actor.user_attributes);
  });

  it('레코드의 actor_id가 StoredTrace로 전파된다', async () => {
    const { app, deps } = buildApp();

    await ingest(
      app,
      buildEnvelope({
        records: [
          buildRecord({
            actor_id: actor.actor_id,
            user_id: actor.user_id,
            user_attributes: actor.user_attributes,
          }),
        ],
      }),
    );

    const trace = await deps.traceStore.findById('trc_001');
    expect(trace?.actorId).toBe(actor.actor_id);
    expect(trace?.userId).toBe(actor.user_id);
    expect(trace?.userAttributes).toEqual(actor.user_attributes);
  });

  it('레코드의 actor_id가 StoredSession으로 전파된다', async () => {
    const { app, deps } = buildApp();

    await ingest(
      app,
      buildEnvelope({
        records: [
          buildRecord({
            qa_session_id: 'qas_001',
            actor_id: actor.actor_id,
            user_id: actor.user_id,
            user_attributes: actor.user_attributes,
          }),
        ],
      }),
    );

    const session = await deps.sessionStore.findById('qas_001');
    expect(session?.actorId).toBe(actor.actor_id);
    expect(session?.userId).toBe(actor.user_id);
    expect(session?.userAttributes).toEqual(actor.user_attributes);
  });

  it('actor 없는 레코드는 trace.actorId가 null이다', async () => {
    const { app, deps } = buildApp();

    await ingest(app, buildEnvelope());

    const trace = await deps.traceStore.findById('trc_001');
    expect(trace?.actorId).toBeNull();
    expect(trace?.userId).toBeNull();
    expect(trace?.userAttributes).toBeNull();
  });
});

describe('POST /v1/ingest — keyObservationStore fail-open', () => {
  it('keyObservationStore.observeBatch 실패 시에도 202를 반환하고 레코드가 저장된다', async () => {
    const failingStore = {
      observe: vi.fn().mockResolvedValue(undefined),
      observeBatch: vi.fn().mockRejectedValue(new Error('observation DB unavailable')),
      findByPrefix: vi.fn().mockResolvedValue([]),
      summary: vi.fn().mockResolvedValue({
        totalKeys: 0,
        totalCount: 0,
        registeredKeys: 0,
        unregisteredKeys: 0,
        prefixBreakdown: {},
      }),
      findStale: vi.fn().mockResolvedValue([]),
      findUnregistered: vi.fn().mockResolvedValue([]),
      prefixSummary: vi.fn().mockResolvedValue([]),
    };

    const deps = buildDeps();
    const app = new Hono();
    app.onError(createErrorHandler(pino({ level: 'silent' })));
    app.route(
      '/',
      createIngestRoutes({
        ...deps,
        keyObservationStore: failingStore,
        knownPrefixes: new Set(['pfx_page']),
      }),
    );

    const envelope = buildEnvelope({
      records: [
        buildRecord({
          log_id: 'log_ko_001',
          address_context: { pfx_page: 'pfx_page:v1:1' },
        }),
      ],
    });

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.record_count).toBe(1);

    const records = await deps.recordStore.findByTraceId('trc_001');
    expect(records).toHaveLength(1);
    expect(records[0]?.logId).toBe('log_ko_001');

    expect(failingStore.observeBatch).toHaveBeenCalledOnce();
  });
});
