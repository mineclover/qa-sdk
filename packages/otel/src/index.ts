// ── Bootstrap ──────────────────────────────────────────
export { initTelemetry, type InitTelemetryOptions } from "./init.js";

// ── Tracer ─────────────────────────────────────────────
export { getTracer } from "./tracer.js";

// ── Env ────────────────────────────────────────────────
export { otelEnvSchema, type OtelEnv } from "./env.js";

// ── sqlcommenter ───────────────────────────────────────
export { buildSqlComment, buildSqlCommentWithTrace, sqlComment } from "./sqlcommenter.js";

// ── Drizzle Instrumentation ────────────────────────────
export { withQueryTracing } from "./drizzle-instrument.js";
