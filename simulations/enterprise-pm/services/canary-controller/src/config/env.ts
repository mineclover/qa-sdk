// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §6 — controller env

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5300),
  CORS_ORIGIN: z.string().default("*"),
  SIM_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SIM_CONTROLLER_CYCLE_MS: z.coerce.number().int().positive().default(30_000),
  SIM_CONTROLLER_ID: z
    .string()
    .regex(/^[0-9A-Z]{8}$/)
    .default("CTRL0001"),
  SIM_CONTROLLER_CONFIG_PATH: z.string().default("./controller-config.yaml"),
  SIM_DB_WRITE_URL: z.string().url(),
  SIM_METRICS_COLLECTOR_URL: z.string().url(),
  QA_INGEST_URL: z.string().url(),
  SIM_AUDIT_RECORDER_URL: z.string().url(),
  SIM_GATEWAY_ADMIN_URL: z.string().url(),
  SIM_COMPOSE_PROJECT: z.string().default("enterprise-pm"),
  SIM_LOAD_RPS_THRESHOLD: z.coerce.number().positive().default(100),
  SIM_CPU_HIGH_PCT: z.coerce.number().min(0).max(100).default(80),
  SIM_DB_POOL_HIGH_PCT: z.coerce.number().min(0).max(100).default(80),
  SIM_SCALE_COOLDOWN_UP_MS: z.coerce.number().int().positive().default(60_000),
  SIM_SCALE_COOLDOWN_DOWN_MS: z.coerce.number().int().positive().default(180_000),
});

export const env = envSchema.parse(process.env);
export type ControllerEnv = z.infer<typeof envSchema>;
