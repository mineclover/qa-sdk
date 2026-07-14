// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryAuditRecorder } from './recorder.js';
import { OtelAuditRecorder } from './otel-wrapper.js';

describe('OtelAuditRecorder', () => {
  let provider: BasicTracerProvider;
  let inner: InMemoryAuditRecorder;
  let rec: OtelAuditRecorder;
  let contextManager: AsyncLocalStorageContextManager;

  beforeEach(() => {
    // 테스트 격리: 글로벌 OTEL 상태 초기화 후 새로 등록.
    trace.disable();
    context.disable();
    contextManager = new AsyncLocalStorageContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(new InMemorySpanExporter()));
    trace.setGlobalTracerProvider(provider);
    inner = new InMemoryAuditRecorder();
    rec = new OtelAuditRecorder(inner);
  });

  afterEach(() => {
    contextManager.disable();
    trace.disable();
    context.disable();
  });

  it('active span 없을 때: 호출자 인자에 의존하되 random spanId 발급', async () => {
    const e = await rec.startExecution({
      // spanId/traceId/parentSpanId를 OTEL에서 채울 수 있어야 하지만,
      // active span 없음 → fallback으로 random ID 생성
      apiId: 'A',
      actorUserId: 'u',
      targetKind: 'r',
      targetId: 'x',
    });
    expect(e.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(e.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(e.parentSpanId).toBeNull();
    expect(e.depth).toBe(0);
  });

  it('active span 있을 때: spanId/traceId/parentSpanId 자동 추출', async () => {
    const tracer = trace.getTracer('test');
    const root = tracer.startSpan('root');

    await context.with(trace.setSpan(context.active(), root), async () => {
      // OtelAuditRecorder는 active span의 spanContext()에서 ID를 읽어
      // 새 entry를 active span의 span_id 자체로 등록 (1:1 매핑 스펙 준수)
      const e = await rec.startExecution({
        apiId: 'A',
        actorUserId: 'u',
        targetKind: 'r',
        targetId: 'x',
      });
      const ctx = root.spanContext();
      expect(e.spanId).toBe(ctx.spanId);
      expect(e.traceId).toBe(ctx.traceId);
      expect(e.parentSpanId).toBeNull(); // root span (parentSpanId 없음)
    });

    root.end();
  });

  it('nested span: parent에 root span ID가 들어감', async () => {
    const tracer = trace.getTracer('test');
    const root = tracer.startSpan('root');

    await context.with(trace.setSpan(context.active(), root), async () => {
      // root의 audit entry 등록
      await rec.startExecution({
        apiId: 'root-api',
        actorUserId: 'u',
        targetKind: 'tx',
        targetId: 'T',
      });

      const child = tracer.startSpan('child');
      await context.with(trace.setSpan(context.active(), child), async () => {
        const e = await rec.startExecution({
          apiId: 'child-api',
          actorUserId: 'u',
          targetKind: 'r',
          targetId: 'x',
        });
        expect(e.spanId).toBe(child.spanContext().spanId);
        expect(e.parentSpanId).toBe(root.spanContext().spanId);
        expect(e.depth).toBe(1);
        expect(e.rootSpanId).toBe(root.spanContext().spanId);
      });
      child.end();
    });

    root.end();
  });

  it('recordCheck도 active span 활용', async () => {
    const tracer = trace.getTracer('test');
    const root = tracer.startSpan('root');

    await context.with(trace.setSpan(context.active(), root), async () => {
      await rec.startExecution({
        apiId: 'A',
        actorUserId: 'u',
        targetKind: 'r',
        targetId: 'x',
      });

      const checkSpan = tracer.startSpan('bitmap-check');
      await context.with(trace.setSpan(context.active(), checkSpan), async () => {
        const c = await rec.recordCheck({
          pass: 'bitmap',
          outcome: 'allow',
          address: 5,
        });
        expect(c.spanId).toBe(checkSpan.spanContext().spanId);
        expect(c.parentSpanId).toBe(root.spanContext().spanId);
      });
      checkSpan.end();
    });
    root.end();
  });

  it('명시적 인자가 active span을 override', async () => {
    const tracer = trace.getTracer('test');
    const root = tracer.startSpan('root');

    await context.with(trace.setSpan(context.active(), root), async () => {
      const e = await rec.startExecution({
        spanId: 'manual-span',
        traceId: 'manual-trace',
        parentSpanId: null,
        apiId: 'A',
        actorUserId: 'u',
        targetKind: 'r',
        targetId: 'x',
      });
      expect(e.spanId).toBe('manual-span');
      expect(e.traceId).toBe('manual-trace');
    });
    root.end();
  });

  it('listByRoot/firstFailure는 inner에 그대로 위임', async () => {
    await rec.startExecution({
      spanId: 'r',
      traceId: 't',
      parentSpanId: null,
      apiId: 'A',
      actorUserId: 'u',
      targetKind: 'tx',
      targetId: 'T',
    });
    expect(await rec.listByRoot('r')).toHaveLength(1);
    expect(await rec.firstFailure('r')).toBeNull();
  });
});
