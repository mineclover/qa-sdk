// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { z } from "zod";
import { getRequiredServicePort } from "@qa-sdk/core";

const DEFAULT_PORT = getRequiredServicePort("sim-metrics-collector");

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  QA_INGEST_URL: z.string().optional(),
  /** Plan 14a가 사용 — 스크레이프 대상 base URL 콤마 구분 */
  SCRAPE_TARGETS: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
