// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-bitmap-pipeline

import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { issueBitmap, verifyBitmap } from './issuer.js';

const NOW = 1_700_000_000_000;
const TTL = 60_000; // 1분

function makeMask(size: number, setBits: number[] = []): Uint8Array {
  const bytes = Math.ceil(size / 8);
  const m = new Uint8Array(bytes);
  for (const b of setBits) m[Math.floor(b / 8)] |= 1 << (b % 8);
  return m;
}

describe('issueBitmap / verifyBitmap', () => {
  const secret = randomBytes(32);

  it('정상 발급 후 검증 성공', () => {
    const b = issueBitmap({
      prefix: 'perm',
      v: 'uv1',
      mask: makeMask(64, [1, 2, 5]),
      issuer: 'auth-service',
      ttlMs: TTL,
      secret,
      now: NOW,
    });
    expect(verifyBitmap({ bitmap: b, secret, now: NOW + 1000 })).toEqual({ ok: true });
  });

  it('만료 후 검증 실패 — expired', () => {
    const b = issueBitmap({
      prefix: 'perm',
      v: 'uv1',
      mask: makeMask(8),
      issuer: 'auth',
      ttlMs: TTL,
      secret,
      now: NOW,
    });
    const result = verifyBitmap({ bitmap: b, secret, now: NOW + TTL + 1 });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('잘못된 secret으로 검증 실패 — signature_mismatch', () => {
    const b = issueBitmap({
      prefix: 'perm',
      v: 'uv1',
      mask: makeMask(8),
      issuer: 'auth',
      ttlMs: TTL,
      secret,
      now: NOW,
    });
    const other = randomBytes(32);
    expect(verifyBitmap({ bitmap: b, secret: other, now: NOW })).toEqual({
      ok: false,
      reason: 'signature_mismatch',
    });
  });

  it('mask 변조 시 signature_mismatch', () => {
    const b = issueBitmap({
      prefix: 'perm',
      v: 'uv1',
      mask: makeMask(8, [1]),
      issuer: 'auth',
      ttlMs: TTL,
      secret,
      now: NOW,
    });
    const tampered = { ...b, mask: makeMask(8, [2]) };
    expect(verifyBitmap({ bitmap: tampered, secret, now: NOW })).toEqual({
      ok: false,
      reason: 'signature_mismatch',
    });
  });

  it('prefix/v/issuer 변조 시 signature_mismatch', () => {
    const b = issueBitmap({
      prefix: 'perm',
      v: 'uv1',
      mask: makeMask(8),
      issuer: 'auth',
      ttlMs: TTL,
      secret,
      now: NOW,
    });
    expect(verifyBitmap({ bitmap: { ...b, v: 'uv2' }, secret, now: NOW }).ok).toBe(false);
    expect(verifyBitmap({ bitmap: { ...b, prefix: 'other' }, secret, now: NOW }).ok).toBe(false);
    expect(verifyBitmap({ bitmap: { ...b, issuer: 'evil' }, secret, now: NOW }).ok).toBe(false);
  });

  it('dual-accept: previousSecrets로 구 서명 허용', () => {
    const oldSecret = randomBytes(32);
    const b = issueBitmap({
      prefix: 'perm',
      v: 'uv1',
      mask: makeMask(8),
      issuer: 'auth',
      ttlMs: TTL,
      secret: oldSecret,
      now: NOW,
    });
    // 현재 secret은 새 것인데 bitmap은 구 secret으로 서명됨
    const newSecret = randomBytes(32);
    const r = verifyBitmap({
      bitmap: b,
      secret: newSecret,
      now: NOW,
      previousSecrets: [oldSecret],
    });
    expect(r).toEqual({ ok: true });
  });

  it('invalid_format — signature 누락', () => {
    const b = issueBitmap({
      prefix: 'perm',
      v: 'uv1',
      mask: makeMask(8),
      issuer: 'auth',
      ttlMs: TTL,
      secret,
      now: NOW,
    });
    const broken = { ...b, signature: '' };
    expect(verifyBitmap({ bitmap: broken, secret, now: NOW })).toEqual({
      ok: false,
      reason: 'invalid_format',
    });
  });

  it('TTL 0 이하 거부', () => {
    expect(() =>
      issueBitmap({
        prefix: 'p',
        v: 'v',
        mask: makeMask(8),
        issuer: 'a',
        ttlMs: 0,
        secret,
        now: NOW,
      }),
    ).toThrow();
  });

  it('secret 너무 짧으면 거부', () => {
    expect(() =>
      issueBitmap({
        prefix: 'p',
        v: 'v',
        mask: makeMask(8),
        issuer: 'a',
        ttlMs: TTL,
        secret: new Uint8Array(10),
        now: NOW,
      }),
    ).toThrow();
  });
});
