// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import { z } from "zod";

export const envSchema = z.object({
  SCENARIO_MODE: z.enum(["in-process", "http"]).default("in-process"),
  SCENARIO_GATEWAY_URL: z.string().default("http://localhost:8888"),
  SCENARIO_AUDIT_URL: z.string().default("http://localhost:5100"),
  SCENARIO_INGEST_URL: z.string().default("http://localhost:3200"),
  /** in-process 모드에서 NestJS app 부팅 시 dialect. */
  QA_DB_DIALECT: z.enum(["sqlite", "pg"]).default("sqlite"),
  /** Redis URL — sim-bitmap-cache 통합. in-process는 mock 사용. */
  SIM_REDIS_URL: z.string().optional(),
  /**
   * sim-handles wiring URLs — Plan E Stage 11 follow-up #24.
   * 시나리오 9~17 e2e용. SIM_SCENARIO_INPROC=1일 때 wireSimHandles가 사용.
   */
  SIM_AUDIT_RECORDER_URL: z.string().default("http://localhost:5100"),
  SIM_CONTROLLER_URL: z.string().default("http://localhost:7070"),
  SIM_AUTH_API_URL: z.string().default("http://localhost:4001"),
  SIM_APPROVAL_API_URL: z.string().default("http://localhost:4002"),
  SIM_BFF_READ_URL: z.string().default("http://localhost:5100/v1/audit/trace"),
  /** 시나리오 in-process 부팅 게이트. SIM_SCENARIO_INPROC=1일 때 wireSimHandles 호출. */
  SIM_SCENARIO_INPROC: z.string().optional(),
});

export type ScenarioEnvVars = z.infer<typeof envSchema>;

export function parseScenarioEnv(
  source: NodeJS.ProcessEnv = process.env,
): ScenarioEnvVars {
  return envSchema.parse(source);
}
