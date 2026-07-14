// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { randomBytes } from 'node:crypto';
import type { Hono } from 'hono';
import { createApp, type AppOptions } from './app.js';
import { signBitmapJwt } from './lib/jwt.js';
import type { VersionedBitmap } from 'permission-engine';

/**
 * 시나리오 runner 공통 fixture — 6 PROXY_TARGETS 의 기본 placeholder URL.
 *
 * 시나리오가 실제 downstream 을 주입해야 할 경우 override 대상. 본 default 는
 * 127.0.0.1:1 (unreachable) — unexpected 호출을 빠르게 502/504 로 실패시켜
 * 테스트 의도(의존 주입 누락)를 명확히 드러낸다.
 */
export const DEFAULT_TEST_PROXY_TARGETS: Readonly<Record<string, string>> = {
  'sim-pm-api': 'http://127.0.0.1:1',
  'sim-approval-api': 'http://127.0.0.1:1',
  'sim-notification-api': 'http://127.0.0.1:1',
  'sim-reporting-api': 'http://127.0.0.1:1',
  'sim-document-api': 'http://127.0.0.1:1',
  'sim-audit-browser-api': 'http://127.0.0.1:1',
};

export interface GatewayTestAppOptions {
  /** 주입 시 사용, 미주입 시 32 byte 랜덤 hex (64자 문자열). */
  jwtSecret?: string;
  /** 주입 시 해당 값, 미주입 시 "uv1". */
  currentBitmapV?: string;
  /** 주입 시 해당 값, 미주입 시 300. */
  jwtTtlSeconds?: number;
  /** override 대상 — 일부 key만 주면 나머지는 DEFAULT 유지. */
  proxyTargets?: Record<string, string>;
  /** authApiUrl 주입. 미주입 시 "http://127.0.0.1:1". */
  authApiUrl?: string;
  /** 주입 시 ms, 미주입 시 500 (단위 테스트 빠른 실패용). */
  proxyTimeoutMs?: number;
}

export interface GatewayTestAppHandle {
  app: Hono;
  secret: string;
  currentBitmapV: string;
  jwtTtlSeconds: number;
  proxyTargets: Record<string, string>;
  authApiUrl: string;
  proxyTimeoutMs: number;
}

/**
 * createGatewayTestApp — 시나리오 runner / 단위 테스트용 Hono app factory.
 *
 * Plan 12a 의 `createApp()` 을 얇게 wrapping — in-memory secret 생성 +
 * default proxy targets 을 주입. 실 downstream 을 연결하려는 시나리오는 proxyTargets
 * 필드로 override (부분 override 도 허용).
 */
export function createGatewayTestApp(opts: GatewayTestAppOptions): GatewayTestAppHandle {
  const secret = opts.jwtSecret ?? randomBytes(32).toString('hex'); // 64 char hex = 32 byte 이상
  const currentBitmapV = opts.currentBitmapV ?? 'uv1';
  const jwtTtlSeconds = opts.jwtTtlSeconds ?? 300;
  const proxyTargets: Record<string, string> = {
    ...DEFAULT_TEST_PROXY_TARGETS,
    ...(opts.proxyTargets ?? {}),
  };
  const authApiUrl = opts.authApiUrl ?? 'http://127.0.0.1:1';
  const proxyTimeoutMs = opts.proxyTimeoutMs ?? 500;

  const appOptions: AppOptions = {
    authApiUrl,
    jwtSecret: secret,
    jwtTtlSeconds,
    currentBitmapV,
    proxyTimeoutMs,
    proxyTargets,
  };
  const app = createApp(appOptions);
  return {
    app,
    secret,
    currentBitmapV,
    jwtTtlSeconds,
    proxyTargets,
    authApiUrl,
    proxyTimeoutMs,
  };
}

export interface IssueTestTokenArgs {
  userId: string;
  /** fixture 사용자의 departmentId. null 허용. */
  departmentId: string | null;
  secret: string;
  bitmapV: string;
  ttlSeconds: number;
  /** 주입 시 그대로 사용, 미주입 시 3바이트 zero mask. */
  mask?: Uint8Array;
  issuer?: string;
  signature?: string;
}

/**
 * issueTestToken — 시나리오 runner 의 fixture 설정 단계에서 즉시 bearer 토큰 발급.
 */
export async function issueTestToken(args: IssueTestTokenArgs): Promise<string> {
  const now = new Date();
  const bitmap: VersionedBitmap = {
    prefix: 'sim.bitmap',
    v: args.bitmapV,
    mask: args.mask ?? new Uint8Array(3),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + args.ttlSeconds * 1000).toISOString(),
    issuer: args.issuer ?? 'test-bootstrap',
    signature: args.signature ?? 'test-signature',
  };
  return signBitmapJwt({
    userId: args.userId,
    bitmap,
    secret: args.secret,
    ttlSeconds: args.ttlSeconds,
  });
}
