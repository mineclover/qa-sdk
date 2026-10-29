// @def.boundary ingest-system
// @def.doc ingest-system

import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  emptyStringToUndefined,
  optionalUrl,
  booleanWithDefaultFalse,
  getRequiredServicePort,
  getServiceDevUrl,
} from '@qa-sdk/core';
import { otelEnvSchema } from '@qa-sdk/otel';

const DEFAULT_PORT = getRequiredServicePort('ingest-server');

/**
 * ~/.qa-sdk/ingest-profile.json에서 프로필 설정을 읽어
 * 환경변수 기본값으로 사용한다. 환경변수가 명시적으로 설정된 경우 우선.
 */
function loadProfileDefaults(): Record<string, string> {
  // 테스트 환경이면 프로필 로딩 스킵
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return {};
  try {
    // service-profile.json (통합 프로필) 우선, 없으면 레거시 ingest-profile.json
    const dir = join(homedir(), '.qa-sdk');
    for (const filename of ['service-profile.json', 'ingest-profile.json']) {
      const profilePath = join(dir, filename);
      if (!existsSync(profilePath)) continue;
      const profile = JSON.parse(readFileSync(profilePath, 'utf-8'));
      const defaults: Record<string, string> = {};
      if (profile.insightsDriver) defaults.INSIGHTS_DRIVER = profile.insightsDriver;
      if (profile.appHub?.endpoint) defaults.APP_HUB_ENDPOINT = profile.appHub.endpoint;
      if (profile.appHub?.projectId) defaults.APP_HUB_PROJECT_ID = profile.appHub.projectId;
      if (profile.appHub?.credential) defaults.APP_HUB_CREDENTIAL = profile.appHub.credential;
      // Plan 07d — ingestServer.dialect/pgUrl/pgSchema 매핑
      const ingestSrv = profile.ingestServer ?? profile.ingest_server ?? {};
      if (ingestSrv.dialect === 'pg') {
        defaults.STORE_DRIVER = 'pg';
        if (ingestSrv.pgUrl) defaults.TRACE_DATABASE_URL = ingestSrv.pgUrl;
        if (ingestSrv.pgSchema) defaults.QA_PG_SCHEMA = ingestSrv.pgSchema;
      } else if (ingestSrv.dialect === 'sqlite') {
        defaults.STORE_DRIVER = 'sqlite';
      }
      return defaults;
    }
    return {};
  } catch (err) {
    console.warn(
      '[ingest] 프로필 로드 실패 — 기본값 사용:',
      err instanceof Error ? err.message : String(err),
    );
    return {};
  }
}

export const envSchema = z
  .object({
    /**
     * Store 드라이버: memory(기본) | sqlite | pg | clickhouse.
     * d1은 Plan 07a 결정(옵션 A)에 따라 sqlite의 deprecation alias — resolveStoreDriver가 매핑.
     */
    STORE_DRIVER: z.enum(['memory', 'sqlite', 'pg', 'clickhouse', 'd1']).default('memory'),
    /** PostgreSQL URL (STORE_DRIVER=pg 시 필수). 미설정 + STORE_DRIVER=memory 시 InMemory 사용. */
    TRACE_DATABASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    /**
     * PG schema. default "ingest".
     * 현재 런타임 미배선: server의 pg 경로는 `@qa-sdk/store` Drizzle store를 쓰고,
     * 이 값을 받는 `stores/pg/factory.ts` createPgIngestStores는 Plan 07d 전환 전까지 호출되지 않는다.
     */
    QA_PG_SCHEMA: z.string().default('ingest'),
    /** SQLite 경로 (STORE_DRIVER=d1 시 Node.js 로컬용). CF Workers에서는 D1 바인딩 사용. */
    SQLITE_PATH: z.preprocess(emptyStringToUndefined, z.string().optional()),
    REDIS_URL: optionalUrl,
    PORT: z.coerce.number().default(DEFAULT_PORT),
    CORS_ORIGIN: z.string().default('*'),
    CLEANUP_CRON_ENABLED: booleanWithDefaultFalse,
    TASK_QUEUE_ENABLED: booleanWithDefaultFalse,
    SSE_SUBSCRIPTION_LIMIT: z.coerce.number().int().positive().default(10),
    DLQ_MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
    REGISTRY_URL: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .url()
        .default(getServiceDevUrl('registry-service') ?? 'http://localhost:3300'),
    ),
    REGISTRY_VALIDATION_MODE: z.enum(['strict', 'warn', 'off']).default('warn'),
    // ── Snapshot gate (ADR-010) ───────────────────────
    /** envelope catalog_snapshot 판정: off | warn(기본, 위반도 수락) | enforce(계약 위반 422) */
    SNAPSHOT_GATE_MODE: z.enum(['off', 'warn', 'enforce']).default('warn'),
    /** snapshot 조회 registry. 미설정 시 REGISTRY_URL */
    SNAPSHOT_REGISTRY_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    // ── Convergence Pipeline ──────────────────────────
    CONVERGENCE_ENABLED: booleanWithDefaultFalse,
    CONVERGENCE_RECORD_THRESHOLD: z.coerce.number().int().positive().default(100),
    CONVERGENCE_DKG_SQLITE_PATH: z.preprocess(emptyStringToUndefined, z.string().optional()),
    /** 주기 flush 간격 — convergence-scheduler가 단독 담당 (D-4) */
    CONVERGENCE_SCHEDULE_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
    CONVERGENCE_REGISTRY_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    // ── Insights ─────────────────────────────────────────
    /** 인사이트 저장소 드라이버: local(SQLite, 기본) | app-hub(Google App Hub) */
    INSIGHTS_DRIVER: z.enum(['local', 'app-hub']).default('local'),
    /** App Hub 엔드포인트 (INSIGHTS_DRIVER=app-hub 시 필수) */
    APP_HUB_ENDPOINT: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    /** App Hub 인증 정보 (서비스 계정 키 경로 또는 토큰) */
    APP_HUB_CREDENTIAL: z.preprocess(emptyStringToUndefined, z.string().optional()),
    /** App Hub 프로젝트 ID */
    APP_HUB_PROJECT_ID: z.preprocess(emptyStringToUndefined, z.string().optional()),
    // ── Catalog ──────────────────────────────────────────
    CATALOG_ID: z.string().default('demo'),
    // ── Pattern Classification ─────────────────────────
    PATTERN_CLASSIFICATION_ENABLED: booleanWithDefaultFalse,
    // ── Decode Service ───────────────────────────────────
    DECODE_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    // ── Transition Engine (Phase 2.5) ─────────────────
    TRANSITION_ENGINE_ENABLED: booleanWithDefaultFalse,
  })
  .merge(otelEnvSchema)
  .superRefine((value, ctx) => {
    if (value.TASK_QUEUE_ENABLED && !value.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REDIS_URL is required when TASK_QUEUE_ENABLED=true',
        path: ['REDIS_URL'],
      });
    }
    if (value.INSIGHTS_DRIVER === 'app-hub') {
      if (!value.APP_HUB_ENDPOINT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'APP_HUB_ENDPOINT is required when INSIGHTS_DRIVER=app-hub',
          path: ['APP_HUB_ENDPOINT'],
        });
      }
      if (!value.APP_HUB_PROJECT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'APP_HUB_PROJECT_ID is required when INSIGHTS_DRIVER=app-hub',
          path: ['APP_HUB_PROJECT_ID'],
        });
      }
    }
  });

let _profileDefaults: Record<string, string> | null = null;

export function parseEnv(source: NodeJS.ProcessEnv) {
  // 프로필 기본값을 환경변수보다 낮은 우선순위로 lazy 적용
  if (!_profileDefaults) _profileDefaults = loadProfileDefaults();
  const merged = { ..._profileDefaults, ...source };
  return envSchema.parse(merged);
}

export type Env = z.infer<typeof envSchema>;

/**
 * STORE_DRIVER=d1 → sqlite 매핑 (Plan 07a 옵션 A 결정).
 *
 * D1(Cloudflare Workers의 SQLite-호환)과 자체 SQLite(node-sqlite)는
 * 동일 dialect이므로 단일 sqlite 어댑터로 통합. d1은 1 release cycle 간 alias.
 */
export function resolveStoreDriver(
  env: Pick<Env, 'STORE_DRIVER'>,
): 'memory' | 'sqlite' | 'pg' | 'clickhouse' {
  if (env.STORE_DRIVER === 'd1') {
    // deprecation: 호출자가 logger로 warning 출력 (본 모듈은 pure).
    return 'sqlite';
  }
  return env.STORE_DRIVER;
}

export const env = parseEnv(process.env);
