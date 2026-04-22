// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { z } from "zod";
import { getRequiredServicePort, getServiceDevUrl } from "@qa-sdk/core";

const DEFAULT_PORT = getRequiredServicePort("sim-gateway");

export const envSchema = z.object({
  // ── 기존 (Plan 10c) ────────────────────────────────────────────
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  QA_INGEST_URL: z.string().optional(),
  /** 비즈니스 서비스 base URL — Plan 12a reverse proxy 사용. */
  AUTH_API_URL: z.string().default(getServiceDevUrl("sim-auth-api") ?? "http://localhost:4400"),
  PM_API_URL: z.string().default(getServiceDevUrl("sim-pm-api") ?? "http://localhost:4500"),
  APPROVAL_API_URL: z.string().default(getServiceDevUrl("sim-approval-api") ?? "http://localhost:4600"),
  NOTIFICATION_API_URL: z.string().default(getServiceDevUrl("sim-notification-api") ?? "http://localhost:4700"),
  REPORTING_API_URL: z.string().default(getServiceDevUrl("sim-reporting-api") ?? "http://localhost:4800"),
  DOCUMENT_API_URL: z.string().default(getServiceDevUrl("sim-document-api") ?? "http://localhost:4900"),
  AUDIT_BROWSER_API_URL: z.string().default(getServiceDevUrl("sim-audit-browser-api") ?? "http://localhost:5100"),
  // ── 신규 (Plan 12a) ────────────────────────────────────────────
  /** HS256 secret. 32바이트 이상 필수 (HMAC baseline). fallback 없음. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be >= 32 bytes (HS256 secure baseline)"),
  /** JWT TTL (초). §2 bitmap-pipeline §2. */
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  /** 현재 활성 bitmap prefix. §2 §6 unified version binding. */
  BITMAP_PREFIX: z.string().default("sim.bitmap"),
  /** downstream reverse proxy timeout (ms). */
  PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  /** §2 §6 unified bitmap version — version mismatch 시 refresh 강제. */
  BITMAP_VERSION: z.string().default("v1"),
  /** Redis pub/sub — §5 Invalidation Subscriber 구동. */
  SIM_REDIS_URL: z.string().default("redis://localhost:6379"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
