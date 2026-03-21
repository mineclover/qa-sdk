import { z } from "zod";
import { booleanWithDefaultFalse } from "@qa-sdk/core";

export const envSchema = z.object({
  PORT: z.coerce.number().default(3300),
  SQLITE_PATH: z.string().default(":memory:"),
  CONSTRAINT_GATE_ENABLED: booleanWithDefaultFalse,
  CONSTRAINT_GATE_MODE: z.enum(["strict", "warn"]).default("warn"),
  CONSTRAINT_GATE_DKG_PATH: z.string().optional(),
  POST_ACTIVATION_HOOK_ENABLED: booleanWithDefaultFalse,
  POST_ACTIVATION_DKG_PATH: z.string().optional(),
  DEV_DASHBOARD_ENABLED: booleanWithDefaultFalse,
  DEV_DASHBOARD_DKG_PATH: z.string().optional(),
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
