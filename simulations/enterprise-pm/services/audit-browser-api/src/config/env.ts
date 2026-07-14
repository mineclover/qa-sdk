// @def.boundary sim-audit-browser-api
// @def.doc sim-erp-pm-design

import { z } from 'zod';
import { getRequiredServicePort } from '@qa-sdk/core';
import { dbEnvSchema } from 'db-bootstrap';

const DEFAULT_PORT = getRequiredServicePort('sim-audit-browser-api');

export const envSchema = dbEnvSchema.extend({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default('*'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z.preprocess(
    (v) => v ?? 'true',
    z.enum(['true', 'false']).transform((v) => v === 'true'),
  ),
  QA_INGEST_URL: z.string().optional(),
  SIM_REDIS_URL: z.string().default('redis://localhost:6379'),
  SIM_GRAPH_RETENTION_KEEP_LATEST: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).optional(),
  ),
  SIM_GRAPH_RETENTION_INTERVAL_MS: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  SIM_GRAPH_RETENTION_RUN_ON_BOOT: z.preprocess(
    (v) => v ?? 'true',
    z.enum(['true', 'false']).transform((v) => v === 'true'),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
