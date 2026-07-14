// @def.boundary ingest-system
// @def.doc ingest-system

import { describe, expect, it, vi, afterEach } from 'vitest';
import type { StoredRecord } from '@qa-sdk/core';
import { RecordStreamBroker, RecordStreamBrokerShutdownError } from './record-stream-broker.js';

function makeRecord(overrides: Partial<StoredRecord> = {}): StoredRecord {
  return {
    logId: 'log_test',
    traceId: 'trc_test',
    spanId: 'spn_test',
    timestamp: new Date('2026-03-14T00:00:00Z'),
    recordKind: 'log',
    eventKey: 'test_event',
    eventVersion: '001',
    payloadFormat: 'json',
    payloadEncoding: 'raw',
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: {},
    createdAt: new Date('2026-03-14T00:00:00Z'),
    ...overrides,
  };
}

describe('RecordStreamBroker — listener error isolation', () => {
  it('sync listener 에러 시 throw 없이 다음 listener 실행', () => {
    const broker = new RecordStreamBroker();
    const goodListener = vi.fn();

    broker.subscribeToScenario('scn_1', () => {
      throw new Error('sync crash');
    });
    broker.subscribeToScenario('scn_1', goodListener);

    expect(() => broker.publishToScenario('scn_1', makeRecord())).not.toThrow();
    expect(goodListener).toHaveBeenCalledTimes(1);
  });

  it('async listener 에러 시 crash 없이 정상 동작', async () => {
    const broker = new RecordStreamBroker();
    const resolved = vi.fn();

    broker.subscribeToScenario('scn_2', () => Promise.reject(new Error('async crash')));
    broker.subscribeToScenario('scn_2', resolved);

    broker.publishToScenario('scn_2', makeRecord());

    // async error가 전파되지 않고 두 번째 listener도 호출됨
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it('sync 에러 listener 뒤의 listener도 실행된다', () => {
    const broker = new RecordStreamBroker();
    const afterListener = vi.fn();

    broker.subscribeToScenario('scn_3', () => {
      throw new Error('crash');
    });
    broker.subscribeToScenario('scn_3', afterListener);

    broker.publishToScenario('scn_3', makeRecord());

    // 각 listener가 독립 try/catch로 감싸져 있으므로 afterListener도 실행됨
    expect(afterListener).toHaveBeenCalledTimes(1);
  });
});

describe('RecordStreamBroker', () => {
  it('clears existing subscribers and rejects new subscriptions after shutdown', () => {
    const broker = new RecordStreamBroker();
    const traceListener = vi.fn();
    const sessionListener = vi.fn();

    const unsubscribeTrace = broker.subscribeToTrace('trace_shutdown', traceListener);
    const unsubscribeSession = broker.subscribeToSession('session_shutdown', sessionListener);

    expect(broker.getTraceSubscriberCount('trace_shutdown')).toBe(1);
    expect(broker.getSessionSubscriberCount('session_shutdown')).toBe(1);

    broker.shutdown();

    expect(broker.isShuttingDown()).toBe(true);
    expect(broker.getTraceSubscriberCount('trace_shutdown')).toBe(0);
    expect(broker.getSessionSubscriberCount('session_shutdown')).toBe(0);
    expect(() => broker.subscribeToTrace('trace_shutdown', vi.fn())).toThrowError(
      RecordStreamBrokerShutdownError,
    );
    expect(() => broker.subscribeToSession('session_shutdown', vi.fn())).toThrowError(
      RecordStreamBrokerShutdownError,
    );

    unsubscribeTrace();
    unsubscribeSession();
  });
});
