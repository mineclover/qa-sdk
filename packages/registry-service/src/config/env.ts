import { z } from "zod";

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
