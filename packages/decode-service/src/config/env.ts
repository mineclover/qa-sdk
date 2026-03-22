import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(3600),
  /** DecodeMap JSON 파일 경로 또는 URL (선택) */
  DECODE_MAP_SOURCE: z.string().optional(),
  /** registry-service URL — startup 시 DecodeMap 자동 fetch */
  REGISTRY_URL: z.string().optional(),
  /** 캐시 TTL (밀리초). 기본 60초. */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
