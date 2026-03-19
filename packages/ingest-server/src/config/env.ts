import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional(),
);

const booleanWithDefaultFalse = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
      return undefined;
    }

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().default(false));

export const envSchema = z.object({
  TRACE_DATABASE_URL: z.string().url(),
  REDIS_URL: optionalUrl,
  PORT: z.coerce.number().default(3200),
  CLEANUP_CRON_ENABLED: booleanWithDefaultFalse,
  TASK_QUEUE_ENABLED: booleanWithDefaultFalse,
  SSE_SUBSCRIPTION_LIMIT: z.coerce.number().int().positive().default(10),
  DLQ_MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  REGISTRY_URL: optionalUrl,
  REGISTRY_VALIDATION_MODE: z.enum(["strict", "warn", "off"]).default("warn"),
}).superRefine((value, ctx) => {
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
