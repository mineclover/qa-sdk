// ── Logger ────────────────────────────────
export {
  QaLogger, TraceContext, applyMasking,
  HttpTransport, NoopTransport,
  DEFAULT_BATCH_SIZE, DEFAULT_FLUSH_INTERVAL_MS,
} from "@qa-sdk/logger";
export type {
  SpanHandle, QaLoggerConfig, MaskingRule,
  Transport, HttpTransportOptions,
} from "@qa-sdk/logger";

// ── Codec ─────────────────────────────────
export { createIndexSDK, createDimWireCodec } from "@qa-sdk/codec";
export type {
  SdkSchema, AxisDef, PrefixDef as CodecPrefixDef,
  AxisEntries, PrefixNames, PrefixDims, PrefixCoord,
  TypedIndexSDK, DimWireCodec,
} from "@qa-sdk/codec";

// ── Context ───────────────────────────────
export { createQaContext, createQaContextAsync, createCatalogProvider } from "@qa-sdk/context";
export type {
  QaContext, QaContextConfig, DslSession, ExecutionMode,
  CatalogProvider, CatalogProviderConfig,
} from "@qa-sdk/context";

// ── Re-export core types for convenience ──
export type {
  EventRecord, TransmissionEnvelope, RecordKind,
  MetricType, SpanStatusCode, PayloadFormat,
  PayloadEncoding, MaskingMode, QaSession,
  ServiceIdentity, DeployContext, ServiceBootConfig,
  TransmissionOwner, TransmissionSource, TransmissionBuild, BuildEnv,
  ActorContext,
} from "@qa-sdk/core";
export {
  newTraceId, newSpanId, newLogId, newQaSessionId, now,
  toServiceDims, toTransmissionSource, toTransmissionBuild,
  catalogEnvToBuildEnv, buildEnvToCatalogEnv,
} from "@qa-sdk/core";
