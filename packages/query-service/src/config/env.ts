// @def.boundary query-api-spec
// @def.doc query-api-spec

import { z } from 'zod';
import { getRequiredServicePort, getServiceDevUrl, emptyStringToUndefined } from '@qa-sdk/core';

const DEFAULT_PORT = getRequiredServicePort('query-service');

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  SQLITE_DRIVER: z.enum(['node', 'better']).default('node'),
  SQLITE_PATH: z.string().default('data/query-service.sqlite'),
  GATE_SERVICE_URL: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .url()
      .default(getServiceDevUrl('gate-service') ?? 'http://localhost:3400'),
  ),
  QUERY_DEFAULT_STRATEGY: z
    .enum(['most-specific', 'priority', 'collect', 'first-match'])
    .default('most-specific'),
  QUERY_GATE_FAILURE_MODE: z.enum(['fail-open', 'fail-closed']).default('fail-open'),
  /** 시점 replay용 RecordStore DB 경로 (미설정 시 SQLITE_PATH 공유) */
  RECORD_STORE_PATH: z.preprocess(emptyStringToUndefined, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
