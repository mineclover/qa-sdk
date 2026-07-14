// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import {
  toCloudEvent,
  fromCloudEvent,
  serializeCloudEvent,
  deserializeCloudEvent,
  toCloudEventBatch,
  fromCloudEventBatch,
} from './cloud-events.js';
import type { EventRecordLike, ManifestRef, CloudEvent } from './cloud-events.js';

const manifest: ManifestRef = {
  source: '//order-service',
  prefix: 'order_event',
  prefixVersion: 'v2',
  manifestVersion: 'v3',
};

const sampleRecord: EventRecordLike = {
  event_key: 'order_submitted',
  timestamp: '2026-04-01T10:30:00Z',
  payload: { orderId: 'ORD-123', amount: 50000 },
  coordinate: 1345,
  trace_id: 'trace_abc',
  qa_session_id: 'session_xyz',
};

describe('toCloudEvent', () => {
  it('EventRecord → CloudEvent 변환', () => {
    const ce = toCloudEvent(sampleRecord, manifest, 'test-id-001');

    expect(ce.specversion).toBe('1.0');
    expect(ce.id).toBe('test-id-001');
    expect(ce.type).toBe('order_submitted');
    expect(ce.source).toBe('//order-service');
    expect(ce.time).toBe('2026-04-01T10:30:00Z');
    expect(ce.datacontenttype).toBe('application/json');
    expect(ce.data).toEqual({ orderId: 'ORD-123', amount: 50000 });
    expect(ce.subject).toBe('order_event:v2:1345');

    // qa-sdk 확장
    expect(ce.qasdk_prefix).toBe('order_event');
    expect(ce.qasdk_prefixversion).toBe('v2');
    expect(ce.qasdk_manifestversion).toBe('v3');
    expect(ce.qasdk_traceid).toBe('trace_abc');
    expect(ce.qasdk_sessionid).toBe('session_xyz');
  });

  it('ID 자동 생성', () => {
    const ce = toCloudEvent(sampleRecord, manifest);
    expect(ce.id).toBeTruthy();
    expect(ce.id.length).toBeGreaterThan(5);
  });

  it('coordinate 없으면 subject 없음', () => {
    const record: EventRecordLike = { event_key: 'test', timestamp: '2026-01-01T00:00:00Z' };
    const ce = toCloudEvent(record, { source: '//test' });
    expect(ce.subject).toBeUndefined();
  });

  it('payload 없으면 data 없음', () => {
    const record: EventRecordLike = { event_key: 'test', timestamp: '2026-01-01T00:00:00Z' };
    const ce = toCloudEvent(record, { source: '//test' });
    expect(ce.data).toBeUndefined();
  });

  it('매니페스트 정보 없으면 확장 속성 없음', () => {
    const ce = toCloudEvent(sampleRecord, { source: '//test' });
    expect(ce.qasdk_prefix).toBeUndefined();
    expect(ce.qasdk_manifestversion).toBeUndefined();
  });
});

describe('fromCloudEvent', () => {
  it('CloudEvent → EventRecord 변환', () => {
    const ce = toCloudEvent(sampleRecord, manifest, 'id-001');
    const record = fromCloudEvent(ce);

    expect(record.event_key).toBe('order_submitted');
    expect(record.timestamp).toBe('2026-04-01T10:30:00Z');
    expect(record.payload).toEqual({ orderId: 'ORD-123', amount: 50000 });
    expect(record.coordinate).toBe(1345);
    expect(record.trace_id).toBe('trace_abc');
    expect(record.qa_session_id).toBe('session_xyz');
  });

  it('라운드트립: EventRecord → CloudEvent → EventRecord', () => {
    const ce = toCloudEvent(sampleRecord, manifest);
    const restored = fromCloudEvent(ce);

    expect(restored.event_key).toBe(sampleRecord.event_key);
    expect(restored.timestamp).toBe(sampleRecord.timestamp);
    expect(restored.payload).toEqual(sampleRecord.payload);
    expect(restored.coordinate).toBe(sampleRecord.coordinate);
    expect(restored.trace_id).toBe(sampleRecord.trace_id);
  });

  it('subject에서 coordinate 추출', () => {
    const ce: CloudEvent = {
      specversion: '1.0',
      id: '1',
      type: 'test',
      source: '//s',
      time: '2026-01-01T00:00:00Z',
      subject: 'order_event:v2:42',
    };
    expect(fromCloudEvent(ce).coordinate).toBe(42);
  });

  it('subject 없으면 coordinate undefined', () => {
    const ce: CloudEvent = {
      specversion: '1.0',
      id: '1',
      type: 'test',
      source: '//s',
      time: '2026-01-01T00:00:00Z',
    };
    expect(fromCloudEvent(ce).coordinate).toBeUndefined();
  });
});

describe('직렬화', () => {
  it('serialize → deserialize 라운드트립', () => {
    const ce = toCloudEvent(sampleRecord, manifest, 'ser-001');
    const json = serializeCloudEvent(ce);
    const restored = deserializeCloudEvent(json);

    expect(restored.id).toBe('ser-001');
    expect(restored.type).toBe('order_submitted');
    expect(restored.qasdk_prefix).toBe('order_event');
  });

  it('잘못된 specversion → 에러', () => {
    expect(() =>
      deserializeCloudEvent('{"specversion":"2.0","id":"1","type":"t","source":"s","time":"t"}'),
    ).toThrow('미지원');
  });

  it('필수 필드 누락 → 에러', () => {
    expect(() => deserializeCloudEvent('{"specversion":"1.0"}')).toThrow('필수 필드 누락');
  });
});

describe('address_context 연결', () => {
  it('address_context가 있으면 subject로 변환', () => {
    const record: EventRecordLike = {
      event_key: 'test',
      timestamp: '2026-01-01T00:00:00Z',
      address_context: { order_event: 'order_event:v2:42' },
    };
    const ce = toCloudEvent(record, manifest);
    expect(ce.subject).toBe('order_event:v2:42');
  });

  it('address_context와 coordinate 모두 있으면 address_context 우선', () => {
    const record: EventRecordLike = {
      event_key: 'test',
      timestamp: '2026-01-01T00:00:00Z',
      address_context: { order_event: 'order_event:v2:99' },
      coordinate: 1345,
    };
    const ce = toCloudEvent(record, manifest);
    expect(ce.subject).toBe('order_event:v2:99');
  });

  it('fromCloudEvent → address_context 복원', () => {
    const ce: CloudEvent = {
      specversion: '1.0',
      id: '1',
      type: 'test',
      source: '//s',
      time: '2026-01-01T00:00:00Z',
      subject: 'order_event:v2:42',
      qasdk_prefix: 'order_event',
    };
    const record = fromCloudEvent(ce);
    expect(record.address_context).toEqual({ order_event: 'order_event:v2:42' });
    expect(record.coordinate).toBe(42);
  });

  it('EventRecord → CloudEvent → EventRecordLike 라운드트립 (address_context)', () => {
    const record: EventRecordLike = {
      event_key: 'order_submitted',
      timestamp: '2026-04-01T10:30:00Z',
      payload: { orderId: 'ORD-123' },
      address_context: { order_event: 'order_event:v2:1345' },
      trace_id: 'trace_abc',
      qa_session_id: 'session_xyz',
    };
    const ce = toCloudEvent(record, manifest, 'rt-001');
    const restored = fromCloudEvent(ce);

    expect(restored.event_key).toBe(record.event_key);
    expect(restored.timestamp).toBe(record.timestamp);
    expect(restored.address_context).toEqual(record.address_context);
    expect(restored.trace_id).toBe(record.trace_id);
    expect(restored.qa_session_id).toBe(record.qa_session_id);
  });
});

describe('배치 변환', () => {
  it('toCloudEventBatch — 여러 레코드 일괄 변환', () => {
    const records: EventRecordLike[] = [
      { event_key: 'a', timestamp: '2026-01-01T00:00:00Z' },
      { event_key: 'b', timestamp: '2026-01-01T00:01:00Z' },
      { event_key: 'c', timestamp: '2026-01-01T00:02:00Z' },
    ];
    const batch = toCloudEventBatch(records, manifest);
    expect(batch).toHaveLength(3);
    expect(batch.map((ce) => ce.type)).toEqual(['a', 'b', 'c']);
    expect(batch.every((ce) => ce.specversion === '1.0')).toBe(true);
  });

  it('fromCloudEventBatch — 배치 역변환', () => {
    const records: EventRecordLike[] = [
      { event_key: 'x', timestamp: '2026-01-01T00:00:00Z', payload: { v: 1 } },
      { event_key: 'y', timestamp: '2026-01-01T00:01:00Z', payload: { v: 2 } },
    ];
    const batch = toCloudEventBatch(records, manifest);
    const restored = fromCloudEventBatch(batch);
    expect(restored).toHaveLength(2);
    expect(restored[0].event_key).toBe('x');
    expect(restored[1].payload).toEqual({ v: 2 });
  });
});
