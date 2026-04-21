// @def.boundary decode-service-system
// @def.doc decode-service-system

import { z } from "zod";
import { getRequiredServicePort, getServiceDevUrl, emptyStringToUndefined } from "@qa-sdk/core";

const DEFAULT_PORT = getRequiredServicePort("decode-service");

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  /** registry-service URL — startup 시 DecodeMap 자동 fetch */
  REGISTRY_URL: z.preprocess(emptyStringToUndefined, z.string().url().default(getServiceDevUrl("registry-service") ?? "http://localhost:3300")),
  /** 캐시 TTL (밀리초). 기본 60초. */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  /** 캐시 드라이버: memory (기본) 또는 redis */
  CACHE_DRIVER: z.enum(["memory", "redis"]).default("memory"),
  /** Redis URL (CACHE_DRIVER=redis 시 필수) */
  REDIS_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.parse(source);
  if (parsed.CACHE_DRIVER === "redis" && !parsed.REDIS_URL) {
    throw new Error("CACHE_DRIVER=redis requires REDIS_URL");
  }
  return parsed;
}

export const env = parseEnv(process.env);
