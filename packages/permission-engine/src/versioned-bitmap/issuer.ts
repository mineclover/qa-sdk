// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * VersionedBitmap 발급 + 검증.
 *
 * HMAC-SHA256으로 서명. Node.js `node:crypto` 사용 — 브라우저 대상은 별도 어댑터 필요.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  type IssueArgs,
  type VerifyArgs,
  type VerifyResult,
  type VersionedBitmap,
} from "./types.js";

// ── 서명 ──────────────────────────────────────────────────────────────────────

/**
 * 서명 입력 string을 결정론적으로 구성.
 * prefix/v/issuer는 문자열, mask/times는 안정적 직렬화.
 */
function buildSigningInput(
  prefix: string,
  v: string,
  mask: Uint8Array,
  issuedAt: string,
  expiresAt: string,
  issuer: string,
): string {
  const maskHex = Buffer.from(mask).toString("hex");
  return [prefix, v, maskHex, issuedAt, expiresAt, issuer].join("|");
}

function sign(input: string, secret: Uint8Array): string {
  return createHmac("sha256", Buffer.from(secret)).update(input).digest("hex");
}

// ── 발급 ──────────────────────────────────────────────────────────────────────

export function issueBitmap(args: IssueArgs): VersionedBitmap {
  if (args.ttlMs <= 0) {
    throw new Error("TTL must be positive");
  }
  if (args.secret.length < 16) {
    throw new Error("HMAC secret must be at least 16 bytes");
  }

  const now = args.now ?? Date.now();
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + args.ttlMs).toISOString();

  const input = buildSigningInput(
    args.prefix, args.v, args.mask, issuedAt, expiresAt, args.issuer,
  );
  const signature = sign(input, args.secret);

  return {
    prefix: args.prefix,
    v: args.v,
    mask: args.mask,
    issuedAt,
    expiresAt,
    issuer: args.issuer,
    signature,
  };
}

// ── 검증 ──────────────────────────────────────────────────────────────────────

export function verifyBitmap(args: VerifyArgs): VerifyResult {
  const { bitmap, secret, now = Date.now(), previousSecrets = [] } = args;

  // 형식 검증
  if (!bitmap.prefix || !bitmap.v || !bitmap.signature || !bitmap.issuedAt || !bitmap.expiresAt) {
    return { ok: false, reason: "invalid_format" };
  }

  // 만료 확인
  const expiresAtMs = Date.parse(bitmap.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return { ok: false, reason: "invalid_format" };
  }
  if (now >= expiresAtMs) {
    return { ok: false, reason: "expired" };
  }

  // 서명 확인 — current + previous 순차 시도
  const input = buildSigningInput(
    bitmap.prefix, bitmap.v, bitmap.mask,
    bitmap.issuedAt, bitmap.expiresAt, bitmap.issuer,
  );
  const candidates = [secret, ...previousSecrets];

  for (const s of candidates) {
    const expected = sign(input, s);
    if (constantTimeEq(expected, bitmap.signature)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: "signature_mismatch" };
}

// ── util ──────────────────────────────────────────────────────────────────────

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
