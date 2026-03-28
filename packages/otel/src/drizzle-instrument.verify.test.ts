import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { withQueryTracing } from "./drizzle-instrument.js";

/**
 * withQueryTracing 실제 동작 검증.
 * InMemorySpanExporter로 span이 정상 생성되는지 확인한다.
 */
describe("withQueryTracing + OTel span 생성 검증", () => {
  const exporter = new InMemorySpanExporter();
  let provider: NodeTracerProvider;

  beforeAll(() => {
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  });

  afterAll(async () => {
    await provider.shutdown();
  });

  it("select → then 호출 시 span이 생성된다", async () => {
    exporter.reset();

    const expectedRows = [{ id: 1, name: "test" }];
    // Drizzle 쿼리 빌더를 흉내내는 mock
    const mockBuilder = {
      from: function () { return this; },
      where: function () { return this; },
      orderBy: function () { return this; },
      comment: function () { return this; },
      // thenable: Drizzle 쿼리 실행 방식
      then: (resolve: (v: unknown) => void) => resolve(expectedRows),
    };
    const mockDb = {
      select: () => mockBuilder,
    };

    const instrumented = withQueryTracing(mockDb);
    const result = await instrumented.select().from().where().orderBy().comment();

    expect(result).toEqual(expectedRows);

    // span이 생성되었는지 확인
    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBeGreaterThanOrEqual(1);

    const span = spans.find((s) => s.name.startsWith("db.select"));
    expect(span).toBeDefined();
    expect(span!.attributes["db.system"]).toBe("postgresql");
    expect(span!.attributes["db.operation"]).toBe("select");
    expect(span!.status.code).toBe(SpanStatusCode.OK);
  });

  it("insert 호출 시 db.insert span이 생성된다", async () => {
    exporter.reset();

    const mockBuilder = {
      values: function () { return this; },
      onConflictDoNothing: function () { return this; },
      comment: function () { return this; },
      then: (resolve: (v: unknown) => void) => resolve(undefined),
    };
    const mockDb = {
      insert: () => mockBuilder,
    };

    const instrumented = withQueryTracing(mockDb);
    await instrumented.insert().values().onConflictDoNothing().comment();

    const spans = exporter.getFinishedSpans();
    const span = spans.find((s) => s.name.startsWith("db.insert"));
    expect(span).toBeDefined();
    expect(span!.attributes["db.operation"]).toBe("insert");
  });

  it("쿼리 에러 시 span에 ERROR 상태가 기록된다", async () => {
    exporter.reset();

    const mockBuilder = {
      from: function () { return this; },
      then: (_resolve: unknown, reject: (e: Error) => void) =>
        reject(new Error("connection refused")),
    };
    const mockDb = {
      select: () => mockBuilder,
    };

    const instrumented = withQueryTracing(mockDb);

    await expect(instrumented.select().from()).rejects.toThrow("connection refused");

    const spans = exporter.getFinishedSpans();
    const span = spans.find((s) => s.name.startsWith("db.select"));
    expect(span).toBeDefined();
    expect(span!.status.code).toBe(SpanStatusCode.ERROR);
    expect(span!.status.message).toBe("connection refused");
    // exception event 기록 확인
    expect(span!.events.length).toBeGreaterThanOrEqual(1);
    expect(span!.events[0].name).toBe("exception");
  });

  it("비-쿼리 프로퍼티는 Proxy가 간섭하지 않는다", () => {
    const mockDb = {
      schema: { tables: ["a", "b"] },
      $client: {},
      select: () => ({ then: (r: (v: unknown) => void) => r([]) }),
    };

    const instrumented = withQueryTracing(mockDb);
    expect(instrumented.schema).toBe(mockDb.schema);
    expect(instrumented.$client).toBe(mockDb.$client);
  });
});
