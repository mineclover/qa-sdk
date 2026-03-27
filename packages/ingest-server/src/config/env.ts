import { z } from "zod";
import { emptyStringToUndefined, optionalUrl, booleanWithDefaultFalse } from "@qa-sdk/core";
import { otelEnvSchema } from "@qa-sdk/otel";

export const envSchema = z.object({
  /** Store 드라이버: memory(기본) | pg | d1 | clickhouse */
  STORE_DRIVER: z.enum(["memory", "pg", "d1", "clickhouse"]).default("memory"),
  /** PostgreSQL URL (STORE_DRIVER=pg 시 필수). 미설정 + STORE_DRIVER=memory 시 InMemory 사용. */
  TRACE_DATABASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  /** SQLite 경로 (STORE_DRIVER=d1 시 Node.js 로컬용). CF Workers에서는 D1 바인딩 사용. */
  SQLITE_PATH: z.preprocess(emptyStringToUndefined, z.string().optional()),
  REDIS_URL: optionalUrl,
  PORT: z.coerce.number().default(3200),
  CORS_ORIGIN: z.string().default("*"),
  CLEANUP_CRON_ENABLED: booleanWithDefaultFalse,
  TASK_QUEUE_ENABLED: booleanWithDefaultFalse,
  SSE_SUBSCRIPTION_LIMIT: z.coerce.number().int().positive().default(10),
  DLQ_MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  REGISTRY_URL: optionalUrl,
  REGISTRY_VALIDATION_MODE: z.enum(["strict", "warn", "off"]).default("warn"),
  // ── Convergence Pipeline ──────────────────────────
  CONVERGENCE_ENABLED: booleanWithDefaultFalse,
  CONVERGENCE_FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  CONVERGENCE_RECORD_THRESHOLD: z.coerce.number().int().positive().default(100),
  CONVERGENCE_DKG_SQLITE_PATH: z.preprocess(emptyStringToUndefined, z.string().optional()),
  CONVERGENCE_SCHEDULE_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  CONVERGENCE_REGISTRY_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  // ── Catalog ──────────────────────────────────────────
  CATALOG_ID: z.string().default("demo"),
  // ── Pattern Classification ─────────────────────────
  PATTERN_CLASSIFICATION_ENABLED: booleanWithDefaultFalse,
  // ── Decode Service ───────────────────────────────────
  DECODE_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  // ── Transition Engine (Phase 2.5) ─────────────────
  TRANSITION_ENGINE_ENABLED: booleanWithDefaultFalse,
  TRANSITION_VIOLATION_MODE: z.enum(["strict", "warn"]).default("warn"),
  TRANSITION_STATE_PATH: z.preprocess(emptyStringToUndefined, z.string().optional()),
}).merge(otelEnvSchema).superRefine((value, ctx) => {
  if (value.TASK_QUEUE_ENABLED && !value.REDIS_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "REDIS_URL is required when TASK_QUEUE_ENABLED=true",
      path: ["REDIS_URL"],
    });
  }
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
