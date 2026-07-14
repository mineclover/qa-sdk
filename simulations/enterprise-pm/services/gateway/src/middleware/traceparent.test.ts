// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { traceparent } from './traceparent.js';
import { trace } from '@opentelemetry/api';

describe('traceparent middleware — W3C propagation', () => {
  it('incoming traceparent 없으면 신규 root span 생성', async () => {
    const app = new Hono();
    let observedTraceId = '';
    app.use('*', traceparent);
    app.get('/x', (c) => {
      const span = trace.getActiveSpan();
      observedTraceId = span?.spanContext().traceId ?? '';
      return c.text('ok');
    });
    await app.request('/x');
    // 신규 trace id (16바이트 = 32 hex char)
    expect(observedTraceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('incoming traceparent 있으면 그 trace id 유지', async () => {
    const app = new Hono();
    let observedTraceId = '';
    app.use('*', traceparent);
    app.get('/x', (c) => {
      const span = trace.getActiveSpan();
      observedTraceId = span?.spanContext().traceId ?? '';
      return c.text('ok');
    });
    const upstreamTrace = '0af7651916cd43dd8448eb211c80319c';
    const upstreamSpan = 'b7ad6b7169203331';
    const tp = `00-${upstreamTrace}-${upstreamSpan}-01`;
    await app.request('/x', { headers: { traceparent: tp } });
    expect(observedTraceId).toBe(upstreamTrace);
  });

  it('malformed traceparent → 신규 root (graceful)', async () => {
    const app = new Hono();
    let traceId = '';
    app.use('*', traceparent);
    app.get('/x', (c) => {
      traceId = trace.getActiveSpan()?.spanContext().traceId ?? '';
      return c.text('ok');
    });
    await app.request('/x', { headers: { traceparent: 'not-a-traceparent' } });
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('응답 헤더에 x-trace-id 노출 (Plan 12c)', async () => {
    const app = new Hono();
    app.use('*', traceparent);
    app.get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/);
  });
});
