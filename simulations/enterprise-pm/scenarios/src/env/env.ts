// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import { z } from "zod";

export const envSchema = z.object({
  SCENARIO_MODE: z.enum(["in-process", "http"]).default("in-process"),
  SCENARIO_GATEWAY_URL: z.string().default("http://localhost:8888"),
  SCENARIO_AUDIT_URL: z.string().default("http://localhost:5100"),
  /** in-process 모드에서 NestJS app 부팅 시 dialect. */
  QA_DB_DIALECT: z.enum(["sqlite", "pg"]).default("sqlite"),
  /** Redis URL — sim-bitmap-cache 통합. in-process는 mock 사용. */
  SIM_REDIS_URL: z.string().optional(),
});

export type ScenarioEnvVars = z.infer<typeof envSchema>;

export function parseScenarioEnv(
  source: NodeJS.ProcessEnv = process.env,
): ScenarioEnvVars {
  return envSchema.parse(source);
}
