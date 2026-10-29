// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * inline(`processPendingPhaseTwo`)·queue(`processPhaseTwoTask`) 경로 동등성 (D-5).
 *
 * 같은 envelope를 두 경로로 처리했을 때 transition 평가 입력과 convergence 알림 trace 집합이 같아야 한다.
 * queue 경로는 trace당 job이므로 notifyCompletion 호출 단위는 다르다 — 비교는 trace 집합 기준.
 */

import type { TaskPayload, TransmissionEnvelope } from '@qa-sdk/core';
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
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { InMemoryTaskQueue } from './lib/in-memory-task-queue.js';
import { registerTaskQueueWorker } from './lib/phase-two-worker.js';
import { RecordStreamBroker } from './lib/record-stream-broker.js';

const SCENARIO_ID = 'scenario_equivalence';

function buildRecord(traceId: string, sessionId: string, suffix: string, eventKey: string) {
  return {
    log_id: `log_${traceId}_${suffix}`,
    timestamp: `2026-03-18T00:00:0${suffix}.000Z`,
    record_kind: 'log' as const,
    trace_id: traceId,
    span_id: `span_${traceId}_${suffix}`,
    event_key: eventKey,
    event_version: '001',
    payload_format: 'json' as const,
    payload_encoding: 'raw' as const,
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: {},
    qa_session_id: sessionId,
    address_context: { page: `page:v1:${suffix}` },
  };
}

function buildEnvelope(): TransmissionEnvelope {
  return {
    transmission_id: 'tx_equivalence',
    sent_at: '2026-03-18T00:00:05.000Z',
    owner: { owner_type: 'workspace', owner_id: 'workspace_1' },
    source: { service_name: 'checkout-api', sdk_name: 'qa-sdk-js', sdk_version: '0.1.0' },
    runtime: { platform: 'node', app_version: '20.12.0' },
    build: { env: 'staging', release_version: '2026.03.18' },
    records: [
      // verdict 계산 대상 (session + scenario)
      buildRecord('trace_scored', 'session_scored', '1', 'checkout.form.updated'),
      buildRecord('trace_scored', 'session_scored', '2', 'checkout.save'),
      // verdict skip 대상 (scenario 미연결 session)
      buildRecord('trace_unscored', 'session_unscored', '3', 'page_view'),
    ],
  } as TransmissionEnvelope;
}

function createHarness() {
  const stores = {
    recordStore: new InMemoryRecordStore(),
    traceStore: new InMemoryTraceStore(),
    graphStore: new InMemoryGraphStore(),
    transmissionStore: new InMemoryTransmissionStore(),
    sessionStore: new InMemorySessionStore(),
    verdictStore: new InMemoryVerdictStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    dlqStore: new InMemoryDlqStore(),
  };
  const processSession = vi.fn(
    (_input: { readonly sessionId: string; readonly events: readonly unknown[] }) => ({
      instances: [],
      violations: [],
      unmatchedCount: 0,
    }),
  );
  const postVerdict = {
    transitionEngine: {
      processSession,
      decodeCtx: (_catalog: unknown, encoded: Record<string, string>) => ({ ...encoded }),
    },
    transitionCatalog: { id: 'catalog' },
    convergencePipeline: { notifyCompletion: vi.fn() },
  };
  return { stores, postVerdict, processSession, logger: pino({ level: 'silent' }) };
}

async function seedScenario(stores: ReturnType<typeof createHarness>['stores']) {
  await stores.scenarioSpecStore.upsert({
    scenario_id: SCENARIO_ID,
    version: '1.0.0',
    domain: 'checkout',
    steps: [
      { id: 'step_form', event_key: 'checkout.form.updated', required: true, kind: 'sequence' },
      { id: 'step_save', event_key: 'checkout.save', required: true, kind: 'sequence' },
    ],
  });
  await stores.sessionStore.upsert({ sessionId: 'session_scored', scenarioId: SCENARIO_ID });
}

async function postEnvelope(app: ReturnType<typeof createApp>) {
  const res = await app.request('/v1/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildEnvelope()),
  });
  expect(res.status).toBe(202);
}

/** 경로 간 비교용 관측값 — transition 입력(trace별 event log_id·decoded context)과 알림 trace 집합 */
async function observe(h: ReturnType<typeof createHarness>) {
  const transitions = h.processSession.mock.calls
    .map(([input]) => ({
      sessionId: input.sessionId,
      events: (input.events as Array<Record<string, unknown>>).map((e) => ({
        log_id: e.log_id,
        address_context: e.address_context,
      })),
    }))
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  const notified = h.postVerdict.convergencePipeline.notifyCompletion.mock.calls
    .flatMap(([traceIds]) => [...(traceIds as readonly string[])])
    .sort();
  const verdicts = await h.stores.verdictStore.findByTraceId('trace_scored');
  return {
    transitions,
    notified,
    verdicts: verdicts.map((v) => ({ traceId: v.traceId, overallVerdict: v.overallVerdict })),
  };
}

async function runInline() {
  const h = createHarness();
  await seedScenario(h.stores);
  const app = createApp({
    ...h.stores,
    ...h.postVerdict,
    recordStreamBroker: new RecordStreamBroker(),
    logger: h.logger,
  });
  await postEnvelope(app);
  return observe(h);
}

async function runQueue() {
  const h = createHarness();
  await seedScenario(h.stores);
  const taskQueue = new InMemoryTaskQueue<TaskPayload>();
  const app = createApp({
    ...h.stores,
    recordStreamBroker: new RecordStreamBroker(),
    logger: h.logger,
    taskQueue,
  });
  await postEnvelope(app);
  // 큐에 쌓인 상태에서는 post-verdict 단계가 아직 실행되지 않는다
  expect(h.processSession).not.toHaveBeenCalled();

  await registerTaskQueueWorker(taskQueue, { ...h.stores, ...h.postVerdict, logger: h.logger });
  await taskQueue.close();
  return observe(h);
}

describe('post-verdict 단계 inline·queue 동등성', () => {
  it('같은 envelope에 대해 transition 입력과 convergence 알림 trace 집합이 같다', async () => {
    const inline = await runInline();
    const queue = await runQueue();

    expect(inline.transitions).toHaveLength(2);
    expect(inline.notified).toEqual(['trace_scored', 'trace_unscored']);
    expect(inline.verdicts).toEqual([{ traceId: 'trace_scored', overallVerdict: 'pass' }]);
    expect(queue).toEqual(inline);
  });
});
