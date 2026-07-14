// @def.boundary ingest-system
// @def.doc ingest-system

// packages/ingest-server/src/lib/extract-key-observations.test.ts

import { describe, expect, it } from 'vitest';
import type { RecordInsert } from '@qa-sdk/core';
import { extractKeyObservations } from './extract-key-observations.js';

function makeRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
  return {
    logId: 'r1',
    traceId: 't1',
    spanId: 's1',
    timestamp: new Date('2026-04-06T10:00:00Z'),
    recordKind: 'log',
    eventKey: 'page.view',
    eventVersion: '001',
    payloadFormat: 'json',
    payloadEncoding: 'raw',
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: null,
    ...overrides,
  };
}

describe('extractKeyObservations', () => {
  it('addressContext에서 entry 추출', () => {
    const records = [
      makeRecord({
        addressContext: { svc: 'svc:v1:42', pv: 'pv:v2:1' },
        payload: { page: 'home' },
      }),
    ];

    const entries = extractKeyObservations(records);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      packedKey: 'svc:v1:42',
      prefixId: 'svc',
      registered: false,
    });
    expect(entries[1]).toMatchObject({ packedKey: 'pv:v2:1', prefixId: 'pv' });
  });

  it('knownPrefixes로 registered 판정', () => {
    const records = [makeRecord({ addressContext: { svc: 'svc:v1:42', unknown: 'unk:v1:0' } })];

    const entries = extractKeyObservations(records, new Set(['svc']));
    const svc = entries.find((e) => e.prefixId === 'svc');
    const unk = entries.find((e) => e.prefixId === 'unknown');
    expect(svc?.registered).toBe(true);
    expect(unk?.registered).toBe(false);
  });

  it('addressContext 없으면 빈 배열', () => {
    const entries = extractKeyObservations([makeRecord()]);
    expect(entries).toHaveLength(0);
  });

  it('payload 샘플은 최대 5 필드', () => {
    const records = [
      makeRecord({
        addressContext: { svc: 'svc:v1:0' },
        payload: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 },
      }),
    ];

    const entries = extractKeyObservations(records);
    expect(Object.keys(entries[0].samplePayload ?? {})).toHaveLength(5);
  });
});
