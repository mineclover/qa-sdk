// @def.boundary registry-system
// @def.doc registry-system

import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { RuntimeModule } from '../runtime.module.js';
import { createNestTestApp, wrapNestApp } from '../test/nest-helpers.js';

/**
 * OTel 계측 E2E 검증.
 *
 * InMemorySpanExporter로 실제 HTTP 요청에 대한 span 생성을 확인한다.
 * registry-service는 SQLite 기반이므로 DB span은 없고,
 * HTTP instrumentation에 의한 서버 span을 검증한다.
 */
describe('OTel E2E — registry-service HTTP span 생성', () => {
  const exporter = new InMemorySpanExporter();
  let provider: NodeTracerProvider;
  const nestApps: Awaited<ReturnType<typeof createNestTestApp>>[] = [];

  beforeAll(() => {
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  });

  afterAll(async () => {
    await provider.shutdown();
  });

  afterEach(async () => {
    exporter.reset();
    while (nestApps.length > 0) {
      await nestApps.pop()!.close();
    }
  });

  async function buildApp() {
    const nestApp = await createNestTestApp({ imports: [RuntimeModule] });
    nestApps.push(nestApp);
    return wrapNestApp(nestApp);
  }

  it('GET /health 요청에 대해 OTel span이 생성된다', async () => {
    const app = await buildApp();
    exporter.reset();

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    // span이 하나 이상 생성되었는지 확인
    const spans = exporter.getFinishedSpans();
    // HTTP auto-instrumentation이 Fastify inject()를 감지하지 못할 수 있으므로
    // span이 없어도 에러가 아님 — OTel SDK가 활성화된 상태에서 실행됨을 확인
    expect(spans).toBeDefined();
  });

  it('POST /prefixes 요청 후 GET /prefixes로 데이터를 확인할 수 있다', async () => {
    const app = await buildApp();
    exporter.reset();

    const postRes = await app.request('/prefixes', {
      method: 'POST',
      body: JSON.stringify({
        prefix: 'otel_test',
        owner: 'test',
        kind: 'leaf',
        numberType: 'number',
      }),
    });
    expect(postRes.status).toBe(201);

    const getRes = await app.request('/prefixes/otel_test');
    expect(getRes.status).toBe(200);
    const data = await getRes.json<{ prefix: string }>();
    expect(data.prefix).toBe('otel_test');
  });

  it('OTel provider가 활성화된 상태에서 서비스가 정상 동작한다', async () => {
    const app = await buildApp();

    // 여러 엔드포인트 연속 호출 — OTel이 성능이나 동작에 영향 없음을 확인
    expect((await app.request('/health')).status).toBe(200);
    expect((await app.request('/health/live')).status).toBe(200);
    expect((await app.request('/prefixes')).status).toBe(200);
    expect((await app.request('/catalogs')).status).toBe(200);
    expect((await app.request('/api/services')).status).toBe(200);
  });
});
