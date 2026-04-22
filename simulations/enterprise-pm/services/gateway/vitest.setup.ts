// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

// 테스트 환경에서 env.ts module-level parseEnv가 JWT_SECRET 요구하므로 사전 주입.
// 각 테스트가 parseEnv({ ... })로 스키마 검증하는 것과 별개.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-32-bytes-long-for-hs256-ok";
}

// OTel TracerProvider + ContextManager — 단위 테스트에서 trace_id가 실존하고
// context.with가 active span을 제대로 전파하도록 등록.
// 미등록 시 NonRecordingSpan이 반환되어 spanContext().traceId === "".
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";

const provider = new BasicTracerProvider();
provider.register({
  propagator: new W3CTraceContextPropagator(),
  contextManager: new AsyncLocalStorageContextManager().enable(),
});
