// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { z } from 'zod';
import { getRequiredServicePort } from '@qa-sdk/core';
import { dbEnvSchema } from 'db-bootstrap';
import type { BitmapIssuerConfig } from '../auth/bitmap/infrastructure/read-model/bitmap-issue.read-model.js';

const DEFAULT_PORT = getRequiredServicePort('sim-auth-api');

export const envSchema = dbEnvSchema.extend({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default('*'),
  /** OTel collector endpoint — undefined면 OTEL_ENABLED=false 효과 */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z.preprocess(
    (v) => v ?? 'true',
    z.enum(['true', 'false']).transform((v) => v === 'true'),
  ),
  /** ingest-server 엔드포인트 — set되면 IngestForwarder 활성화 */
  QA_INGEST_URL: z.string().optional(),
  /** Redis pub/sub — Plan 12b가 사용. 본 plan에서는 read-only 노출. */
  SIM_REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Bitmap 슬라이스 — VersionedBitmap 서명 secret. */
  SIM_BITMAP_SECRET: z.string().default('dev-only-bitmap-secret-32-bytes-min!'),
  /** Bitmap 슬라이스 — VersionedBitmap TTL (ms). */
  SIM_BITMAP_TTL_MS: z.coerce.number().int().positive().default(3600_000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();

/**
 * Bitmap 슬라이스용 issuer 설정 빌더.
 *
 * 라이브러리 컨벤션 준수: 슬라이스 모듈은 process.env 에 접근하지 않고,
 * 서비스 부팅 시 한 번 파싱된 env 로부터 BitmapSliceModule.forRoot 인자를
 * 만들어 주입한다.
 */
export function buildBitmapIssuerConfig(source: Env = env): BitmapIssuerConfig {
  return {
    secret: new TextEncoder().encode(source.SIM_BITMAP_SECRET),
    ttlMs: source.SIM_BITMAP_TTL_MS,
    issuer: 'sim-auth-api',
    version: 'v1',
  };
}
