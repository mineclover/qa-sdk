/**
 * 테스트용 JWT 생성 유틸.
 *
 * Zitadel 없이 로컬에서 permission middleware를 테스트할 때 사용.
 * 서명은 HS256 단순 서명 (프로덕션에서는 Zitadel JWKS 검증).
 */

import { createHmac } from "node:crypto";

export interface TestTokenOptions {
  sub: string; // user ID
  email?: string;
  perms?: Record<string, string>; // domain -> base64 bitmask
  perms_v?: number;
  perms_schema?: string;
  exp?: number; // unix timestamp (기본: 1시간 후)
}

/** Base64url 인코딩 */
function base64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

/**
 * 테스트용 JWT 생성 (HS256 -- 로컬 테스트 전용).
 * gateway의 AUTH_MODE=jwt에서 사용.
 */
export function createTestJwt(options: TestTokenOptions, secret: string = "test-secret"): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: options.sub,
    email: options.email ?? `${options.sub}@test.local`,
    iat: now,
    exp: options.exp ?? now + 3600,
    perms_v: options.perms_v ?? 1,
    perms_schema: options.perms_schema ?? "test-schema",
  };

  // perms가 undefined이면 claims에 포함하지 않음 (403 테스트용)
  if (options.perms !== undefined) {
    payload.perms = options.perms;
  }

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  // HS256 서명
  const signature = createHmac("sha256", secret).update(data).digest("base64url");

  return `${data}.${signature}`;
}

/**
 * 미리 정의된 테스트 토큰들.
 */
export const TEST_TOKENS = {
  /** 관리자 -- 모든 권한 (12 features: 0xFF 0x0F) */
  admin: () =>
    createTestJwt({
      sub: "admin-001",
      email: "admin@qa-sdk.io",
      perms: { shop: "/w8=", infra: "/w8=" }, // 0xFF, 0x0F = 12비트 전부 on
      perms_v: 1,
      perms_schema: "test",
    }),

  /** 읽기 전용 -- read 권한만 (ingest_read, registry_read, gate_read, query_read, decode_read, definition_read, decision_read, monitoring_read) */
  reader: () =>
    createTestJwt({
      sub: "reader-001",
      email: "reader@qa-sdk.io",
      perms: { shop: "fQk=", infra: "fQk=" }, // 0x7D,0x09 = bits 0,2,3,4,5,6,8,11 (viewer role)
      perms_v: 1,
      perms_schema: "test",
    }),

  /** 만료됨 */
  expired: () =>
    createTestJwt({
      sub: "expired-001",
      exp: Math.floor(Date.now() / 1000) - 3600, // 1시간 전 만료
    }),

  /** perms 없음 */
  noPerms: () =>
    createTestJwt({
      sub: "noauth-001",
      perms: undefined,
    }),
};
