// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, expect, it } from 'vitest';
import type { TransmissionEnvelope } from '@qa-sdk/core';
import { isCodecContractError } from '@qa-sdk/core';
import { decodeEnvelope, encodeEnvelope } from './codec.js';

describe('codec-proto', () => {
  it('TransmissionEnvelope를 손실 없이 round-trip한다', () => {
    const envelope: TransmissionEnvelope = {
      transmission_id: 'tx-1',
      sent_at: '2026-04-07T00:00:00.000Z',
      owner: { owner_type: 'tenant', owner_id: 'tenant-1' },
      source: { service_name: 'svc', sdk_name: '@qa-sdk/sdk', sdk_version: '0.1.0' },
      runtime: {
        platform: 'node',
        device_ref: 'm2',
        os_version: 'macOS',
        app_version: '1.2.3',
      },
      build: {
        env: 'dev',
        build_ref: 'abc123',
        release_version: '2026.04.07',
      },
      infra_context: { service: 'service:v1:42' },
      entry_snapshot: 'snap-demo-v1',
      records: [
        {
          log_id: 'log-1',
          timestamp: '2026-04-07T00:00:00.000Z',
          record_kind: 'metric',
          trace_id: 'trace-1',
          span_id: 'span-1',
          parent_span_id: 'parent-1',
          event_key: 'demo.metric',
          event_version: 'v1',
          span_name: 'metric span',
          start_time: '2026-04-07T00:00:00.000Z',
          end_time: '2026-04-07T00:00:01.000Z',
          status_code: 'ok',
          payload_format: 'json',
          payload_encoding: 'raw',
          payload_masking_applied: true,
          payload_masked_fields: ['email'],
          payload: { ok: true, count: 0 },
          qa_session_id: 'session-1',
          address_context: { endpoint: 'endpoint:v1:10' },
          metric_type: 'gauge',
          metric_name: 'latency',
          metric_value: 0,
          metric_unit: 'ms',
          metric_labels: { method: 'GET' },
          metric_buckets: [1, 2, 3],
          metric_quantiles: [0.5, 0.95],
          actor_id: 'actor-1',
          user_id: 'user-1',
          user_attributes: { tier: 'pro' },
        },
      ],
    };

    const decoded = decodeEnvelope(encodeEnvelope(envelope));
    expect(decoded).toEqual(envelope);
  });
});

function minimalEnvelope(overrides: Partial<TransmissionEnvelope> = {}): TransmissionEnvelope {
  return {
    transmission_id: 'tx-2',
    sent_at: '2026-10-29T00:00:00.000Z',
    owner: { owner_type: 'tenant', owner_id: 't' },
    source: { service_name: 'svc', sdk_name: 'sdk', sdk_version: '0.1.0' },
    runtime: { platform: 'node' },
    build: { env: 'dev' },
    records: [
      {
        log_id: 'log-1',
        timestamp: '2026-10-29T00:00:00.000Z',
        record_kind: 'log',
        trace_id: 'trace-1',
        span_id: 'span-1',
        event_key: 'demo.event',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
    ],
    ...overrides,
  } as TransmissionEnvelope;
}

describe('codec-proto catalog_snapshot (D-2)', () => {
  const catalog_snapshot = {
    catalog_id: 'demo',
    snapshot_version: 7,
    digest: `sha256:${'b'.repeat(64)}`,
    codec_version: 'legacy-v1',
  };

  it('catalog_snapshot을 round-trip한다', () => {
    const decoded = decodeEnvelope(encodeEnvelope(minimalEnvelope({ catalog_snapshot })));
    expect(decoded.catalog_snapshot).toEqual(catalog_snapshot);
  });

  it('snapshot_version이 없어도 round-trip한다', () => {
    const { snapshot_version: _omit, ...withoutVersion } = catalog_snapshot;
    const decoded = decodeEnvelope(
      encodeEnvelope(minimalEnvelope({ catalog_snapshot: withoutVersion })),
    );
    expect(decoded.catalog_snapshot).toEqual(withoutVersion);
  });

  it('필드가 없으면 decode 결과에도 없다', () => {
    expect(decodeEnvelope(encodeEnvelope(minimalEnvelope())).catalog_snapshot).toBeUndefined();
  });
});

describe('codec-proto CorruptEnvelope', () => {
  // 필드 경계에서 정확히 잘리면 proto3 형식상 '필드가 빠진 정상 메시지'가 된다 — 그 경우는 ingest의 zod 검증이 거부한다
  it('필드 중간에서 잘린 바이트는 정상 값으로 읽지 않고 CorruptEnvelope로 거부한다', () => {
    const bytes = encodeEnvelope(
      minimalEnvelope({
        catalog_snapshot: {
          catalog_id: 'demo',
          digest: `sha256:${'b'.repeat(64)}`,
          codec_version: 'legacy-v1',
        },
      }),
    );
    for (const cut of [1, 3, Math.floor(bytes.length / 2), bytes.length - 1]) {
      let error: unknown;
      try {
        decodeEnvelope(bytes.slice(0, cut));
      } catch (caught) {
        error = caught;
      }
      expect(isCodecContractError(error, 'CorruptEnvelope'), `cut=${cut}`).toBe(true);
    }
  });

  it('지원하지 않는 wire type은 CorruptEnvelope', () => {
    // field 15, wire type 3 (start group) — proto3에서 쓰지 않는다
    expect(() => decodeEnvelope(new Uint8Array([(15 << 3) | 3]))).toThrow('[CorruptEnvelope]');
  });
});
