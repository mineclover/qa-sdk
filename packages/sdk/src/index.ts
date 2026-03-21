// ── Logger ───────────────────────────────────────────────

export { QaLogger } from "./logger.js";
export type { SpanHandle } from "./logger.js";

// ── Config ──────────────────────────────────────────────

export type { QaLoggerConfig } from "./config.js";
export { DEFAULT_BATCH_SIZE, DEFAULT_FLUSH_INTERVAL_MS } from "./config.js";

// ── Context ─────────────────────────────────────────────

export { TraceContext } from "./context.js";

// ── Masking ─────────────────────────────────────────────

export { applyMasking } from "./masking.js";
export type { MaskingRule } from "./masking.js";

// ── Transport ───────────────────────────────────────────

export type { Transport } from "./transport/transport.js";
export { HttpTransport } from "./transport/http.js";
export type { HttpTransportOptions } from "./transport/http.js";
export { NoopTransport } from "./transport/noop.js";

// ── Re-export core types for convenience ────────────────

export type {
  EventRecord,
  TransmissionEnvelope,
  RecordKind,
  MetricType,
  SpanStatusCode,
  PayloadFormat,
  PayloadEncoding,
  MaskingMode,
  QaSession,
} from "@qa-sdk/core";

export {
  newTraceId,
  newSpanId,
  newLogId,
  newQaSessionId,
  now,
} from "@qa-sdk/core";

// ── Typed SDK ──────────────────────────────────────────────

export { createIndexSDK } from "./typed-sdk.js";
export type {
  SdkSchema,
  AxisDef,
  PrefixDef,
  AxisEntries,
  PrefixNames,
  PrefixDims,
  PrefixCoord,
  TypedIndexSDK,
} from "./typed-sdk.js";

// ── Dim Wire Format ────────────────────────────────────────

export { createDimWireCodec } from "./dim-wire.js";
export type { DimWireCodec } from "./dim-wire.js";

// ── QaContext (DSL DB 앱 진입점) ─────────────────────────────

export { createQaContext, createQaContextAsync } from "./qa-context.js";
export type { QaContext, QaContextConfig, DslSession, ExecutionMode } from "./qa-context.js";

// ── CatalogProvider (registry/local 추상화) ──────────────────

export { createCatalogProvider } from "./catalog-provider.js";
export type { CatalogProvider, CatalogProviderConfig } from "./catalog-provider.js";
