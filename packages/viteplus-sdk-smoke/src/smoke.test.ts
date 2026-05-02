import { describe, expect, it } from 'vitest';
import { runSdkSmoke } from './smoke.js';

describe('runSdkSmoke', () => {
  it('qa-sdk 엔벨로프를 noop transport로 flush한다', async () => {
    const snapshot = await runSdkSmoke('test');

    expect(snapshot.consumerId).toBe('@qa-sdk/viteplus-sdk-smoke');
    expect(snapshot.transportMode).toBe('noop');
    expect(snapshot.sessionId).toMatch(/^qas_/);
    expect(snapshot.traceId).toMatch(/^trc_/);
    expect(snapshot.flushedEnvelopeCount).toBe(1);
    expect(snapshot.firstEnvelope.source.sdk_name).toBe('@qa-sdk/sdk');
    expect(snapshot.firstEnvelope.records).toHaveLength(3);
    expect(snapshot.firstEnvelope.records[0]?.event_key).toBe('session_start');
    expect(snapshot.firstEnvelope.records[1]?.event_key).toBe('sdk_smoke_loaded');
    expect(snapshot.firstEnvelope.records[2]?.metric_name).toBe('sdk_smoke_records');
  });
});
