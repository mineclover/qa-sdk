import { z } from "zod";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { booleanWithDefaultFalse } from "@qa-sdk/core";

/** ~/.qa-sdk/state.sqlite 기본 DKG 경로 */
function defaultDkgPath(): string | undefined {
  const home = process.env["HOME"] ?? process.env["USERPROFILE"];
  if (!home) return undefined;
  const p = join(home, ".qa-sdk", "state.sqlite");
  return existsSync(p) ? p : undefined;
}

export const envSchema = z.object({
  PORT: z.coerce.number().default(3300),
  CORS_ORIGIN: z.string().default("*"),
  SQLITE_PATH: z.string().default(":memory:"),
  CONSTRAINT_GATE_ENABLED: booleanWithDefaultFalse,
  CONSTRAINT_GATE_MODE: z.enum(["strict", "warn"]).default("warn"),
  CONSTRAINT_GATE_DKG_PATH: z.string().optional(),
  POST_ACTIVATION_HOOK_ENABLED: booleanWithDefaultFalse,
  POST_ACTIVATION_DKG_PATH: z.string().optional(),
  /** Dev Dashboard — DKG_PATH가 있으면 자동 활성화 */
  DEV_DASHBOARD_ENABLED: z.preprocess(
    (v) => v ?? (defaultDkgPath() ? "true" : "false"),
    z.enum(["true", "false"]).transform(v => v === "true"),
  ),
  DEV_DASHBOARD_DKG_PATH: z.preprocess(
    (v) => v || defaultDkgPath(),
    z.string().optional(),
  ),
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
