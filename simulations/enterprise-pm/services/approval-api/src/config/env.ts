// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { z } from "zod";
import { getRequiredServicePort } from "@qa-sdk/core";
import { dbEnvSchema } from "db-bootstrap";

const DEFAULT_PORT = getRequiredServicePort("sim-approval-api");

export const envSchema = dbEnvSchema.extend({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  /** OTel collector endpoint — undefined면 OTEL_ENABLED=false 효과 */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  /** ingest-server 엔드포인트 — set되면 IngestForwarder 활성화 */
  QA_INGEST_URL: z.string().optional(),
  /** Redis pub/sub — Plan 12b가 사용. 본 plan에서는 read-only 노출. */
  SIM_REDIS_URL: z.string().default("redis://localhost:6379"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
