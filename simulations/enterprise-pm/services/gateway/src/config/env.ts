// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { z } from "zod";
import { getRequiredServicePort, getServiceDevUrl } from "@qa-sdk/core";

const DEFAULT_PORT = getRequiredServicePort("sim-gateway");

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  QA_INGEST_URL: z.string().optional(),
  /** 비즈니스 서비스 base URL — Plan 12a가 실제 라우팅에 사용. 본 plan은 미사용. */
  AUTH_API_URL: z.string().default(getServiceDevUrl("sim-auth-api") ?? "http://localhost:4400"),
  PM_API_URL: z.string().default(getServiceDevUrl("sim-pm-api") ?? "http://localhost:4500"),
  APPROVAL_API_URL: z.string().default(getServiceDevUrl("sim-approval-api") ?? "http://localhost:4600"),
  NOTIFICATION_API_URL: z.string().default(getServiceDevUrl("sim-notification-api") ?? "http://localhost:4700"),
  REPORTING_API_URL: z.string().default(getServiceDevUrl("sim-reporting-api") ?? "http://localhost:4800"),
  DOCUMENT_API_URL: z.string().default(getServiceDevUrl("sim-document-api") ?? "http://localhost:4900"),
  AUDIT_BROWSER_API_URL: z.string().default(getServiceDevUrl("sim-audit-browser-api") ?? "http://localhost:5100"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
