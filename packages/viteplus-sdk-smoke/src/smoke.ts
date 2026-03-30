import { NoopTransport, now, type TransmissionEnvelope } from '@qa-sdk/sdk';
import { createQaBridge } from './qa-bridge.js';

const CONSUMER_ID = '@qa-sdk/viteplus-sdk-smoke';

export interface SmokeSnapshot {
  consumerId: string;
  transportMode: 'noop' | 'http' | 'custom';
  sessionId: string;
  traceId: string;
  flushedEnvelopeCount: number;
  firstEnvelope: TransmissionEnvelope;
}

export async function runSdkSmoke(mode = 'development'): Promise<SmokeSnapshot> {
  const bridge = createQaBridge({
    serviceName: 'viteplus-sdk-smoke',
    owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
    buildEnv: mode,
    flushIntervalMs: 0,
    transport: new NoopTransport(),
  });
  const { sessionId, traceId } = bridge.startSession('viteplus_sdk_smoke');

  bridge.emitEvent('sdk_smoke_loaded', {
    consumer: CONSUMER_ID,
    mode,
    created_at: now(),
    transport: bridge.transportMode,
  });

  bridge.emitMetric('sdk_smoke_records', 1, {
    type: 'counter',
    labels: {
      consumer: CONSUMER_ID,
      mode,
    },
  });

  await bridge.shutdown();

  const sent = bridge.getDebugEnvelopes();
  const firstEnvelope = sent[0];
  if (!firstEnvelope) {
    throw new Error('스모크 실행 결과 엔벨로프가 생성되지 않았습니다.');
  }

  return {
    consumerId: CONSUMER_ID,
    transportMode: bridge.transportMode,
    sessionId,
    traceId,
    flushedEnvelopeCount: sent.length,
    firstEnvelope,
  };
}
