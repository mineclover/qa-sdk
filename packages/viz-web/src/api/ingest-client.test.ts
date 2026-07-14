// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSessionRecords } from './ingest-client.js';

function makeEventRecord(logId: string, timestamp = '2024-01-01T00:00:00.000Z') {
  return {
    log_id: logId,
    timestamp,
    record_kind: 'log',
    trace_id: 'trc_test',
    span_id: `spn_${logId}`,
    event_key: 'test_event',
    event_version: '001',
    payload_format: 'json',
    payload_encoding: 'raw',
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: {},
    qa_session_id: 'qas_test',
  };
}

function mockFetchPage(items: object[], next_cursor: string | null, has_more: boolean) {
  return Promise.resolve(
    new Response(JSON.stringify({ items, next_cursor, has_more }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('getSessionRecords', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns records from a single page', async () => {
    const items = [makeEventRecord('log1'), makeEventRecord('log2')];
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchPage(items, null, false) as never);

    const result = await getSessionRecords('qas_test');

    expect(result).toHaveLength(2);
    expect(result[0].logId).toBe('log1');
    expect(result[1].logId).toBe('log2');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('follows cursor across multiple pages', async () => {
    const page1 = [makeEventRecord('log1'), makeEventRecord('log2')];
    const page2 = [makeEventRecord('log3')];

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchPage(page1, 'cursor_abc', true) as never)
      .mockResolvedValueOnce(mockFetchPage(page2, null, false) as never);

    const result = await getSessionRecords('qas_test');

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.logId)).toEqual(['log1', 'log2', 'log3']);
    expect(fetch).toHaveBeenCalledTimes(2);

    const secondCallUrl = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(secondCallUrl).toContain('cursor=cursor_abc');
  });

  it('returns empty array when no records exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchPage([], null, false) as never);
    const result = await getSessionRecords('qas_empty');
    expect(result).toEqual([]);
  });

  it('converts EventRecord (snake_case) to StoredRecord (camelCase)', async () => {
    const item = {
      ...makeEventRecord('log1', '2024-06-01T12:00:00.000Z'),
      parent_span_id: 'spn_parent',
      span_name: 'my_span',
      _registry_warning: 'unknown event',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchPage([item], null, false) as never);

    const [record] = await getSessionRecords('qas_test');

    expect(record.logId).toBe('log1');
    expect(record.traceId).toBe('trc_test');
    expect(record.parentSpanId).toBe('spn_parent');
    expect(record.spanName).toBe('my_span');
    expect(record.registryWarning).toBe('unknown event');
    expect(record.timestamp).toBeInstanceOf(Date);
    expect(record.qaSessionId).toBe('qas_test');
  });

  it('throws a descriptive error when the API returns non-2xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('session not found', { status: 404 }) as never,
    );
    await expect(getSessionRecords('qas_missing')).rejects.toThrow(/404/);
  });

  it('throws when response is missing items array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ wrong: 'shape' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    );
    await expect(getSessionRecords('qas_test')).rejects.toThrow(/ingest-client:getSessionRecords/);
  });
});
