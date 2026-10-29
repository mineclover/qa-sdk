// @def.boundary decode-service-system
// @def.doc decode-service-system

import { z } from 'zod';
import { getRequiredServicePort, getServiceDevUrl, emptyStringToUndefined } from '@qa-sdk/core';

const DEFAULT_PORT = getRequiredServicePort('decode-service');

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  /** registry-service URL — DecodeMap 로드·갱신 대상 */
  REGISTRY_URL: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .url()
      .default(getServiceDevUrl('registry-service') ?? 'http://localhost:3300'),
  ),
  /** decode 결과 L2 캐시(redis) TTL (밀리초). 기본 60초. decoder 자체는 만료하지 않는다 */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  /** registry catalog digest 확인 주기 (밀리초). 바뀌었을 때만 decode-map을 다시 불러온다. 0이면 부팅 때 한 번만 */
  DECODE_MAP_REFRESH_MS: z.coerce.number().int().nonnegative().default(60_000),
  /** 캐시 드라이버: memory (기본) 또는 redis */
  CACHE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
  /** Redis URL (CACHE_DRIVER=redis 시 필수) */
  REDIS_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.parse(source);
  if (parsed.CACHE_DRIVER === 'redis' && !parsed.REDIS_URL) {
    throw new Error('CACHE_DRIVER=redis requires REDIS_URL');
  }
  return parsed;
}

export const env = parseEnv(process.env);
