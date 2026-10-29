/**
 * gateway Node 서버 환경변수 — 서비스 규칙대로 zod 스키마 한 곳에서 읽는다.
 *
 * 서비스 URL(`INGEST_URL` 등)은 lib/route-table.ts `GATEWAY_SERVICES`의 `urlEnv`가 정본이고,
 * 여기서는 그 키들을 스키마에 포함해 형식만 검증한다. CF Worker는 바인딩 Env를 쓰므로 이 파일을 쓰지 않는다.
 */
import { z } from 'zod';
import { GATEWAY_SERVICES } from '../lib/route-table.js';

/** 빈 문자열은 미설정으로 본다 */
const blankAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(blankAsUndefined, z.string().optional());
const optionalUrl = z.preprocess(blankAsUndefined, z.string().url().optional());

const serviceUrlShape = Object.fromEntries(
  Object.values(GATEWAY_SERVICES).map((target) => [target.urlEnv, optionalUrl]),
) as Record<string, typeof optionalUrl>;

export const envSchema = z.object({
  ...serviceUrlShape,
  /** 인증 모드. 기본값 bypass는 개발용 — 외부 노출 시 반드시 지정 */
  AUTH_MODE: z.enum(['bypass', 'api-key', 'jwt', 'tailscale']).default('bypass'),
  /** api-key 모드 키 목록 (쉼표 구분) */
  AUTH_API_KEYS: optionalString,
  /** 동적 라우트를 받아 올 registry. 미설정 시 GATEWAY_SERVICES.registry 기본값 */
  REGISTRY_URL: z.preprocess(
    blankAsUndefined,
    z.string().url().default(GATEWAY_SERVICES.registry.defaultUrl),
  ),
  PORT: z.coerce.number().int().positive().default(8787),
  /** 배포 환경 — registry 동적 라우트 조회(`/api/services/gateway?env=`)와 enrichment에 전달 */
  GATEWAY_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  JWKS_URL: optionalUrl,
  ENRICHMENT_JWT_SECRET: optionalString,
  ENRICHMENT_URL: optionalUrl,
  ZITADEL_URL: optionalUrl,
  ZITADEL_SERVICE_TOKEN: optionalString,
});

export type GatewayEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): GatewayEnv {
  return envSchema.parse(source);
}
