import { z } from "zod";
import { getServicePort, getServiceDevUrl, emptyStringToUndefined } from "@qa-sdk/core";

const DEFAULT_PORT = getServicePort("decode-service") ?? 3600;

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  /** registry-service URL — startup 시 DecodeMap 자동 fetch */
  REGISTRY_URL: z.preprocess(emptyStringToUndefined, z.string().url().default(getServiceDevUrl("registry-service") ?? "http://localhost:3300")),
  /** 캐시 TTL (밀리초). 기본 60초. */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
