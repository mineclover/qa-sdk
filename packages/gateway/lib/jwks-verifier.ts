/**
 * JWKS 서명 검증기 — Zitadel 등 OIDC 프로바이더의 RS256 JWT를 검증한다.
 *
 * 1. JWKS 엔드포인트에서 공개키 fetch (1시간 캐시)
 * 2. kid로 키 매칭, 캐시 miss 시 자동 리프레시
 * 3. node:crypto로 RS256 서명 검증
 * 4. exp 만료 체크
 */

import { createVerify } from "node:crypto";

export interface JWK {
  kid: string;
  kty: string;
  n: string; // modulus (base64url)
  e: string; // exponent (base64url)
  alg?: string;
  use?: string;
}

interface JWKSCache {
  keys: JWK[];
  fetchedAt: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1시간

export class JwksVerifier {
  private cache: JWKSCache | null = null;

  constructor(private jwksUrl: string) {}

  async verify(
    token: string,
  ): Promise<{
    payload: Record<string, unknown>;
    header: Record<string, unknown>;
  }> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");

    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString(),
    ) as Record<string, unknown>;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString(),
    ) as Record<string, unknown>;

    // 만료 체크
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      throw new Error("Token expired");
    }

    // 서명 키 조회
    const keys = await this.getKeys();
    const kid = header.kid as string | undefined;
    const key = kid ? keys.find((k) => k.kid === kid) : undefined;

    if (!key) {
      // 캐시 리프레시 후 재시도
      this.cache = null;
      const refreshedKeys = await this.getKeys();
      const refreshedKey = kid
        ? refreshedKeys.find((k) => k.kid === kid)
        : undefined;
      if (!refreshedKey) throw new Error("Signing key not found");
      return this.verifyWithKey(parts, refreshedKey, header, payload);
    }

    return this.verifyWithKey(parts, key, header, payload);
  }

  private verifyWithKey(
    parts: string[],
    key: JWK,
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): { payload: Record<string, unknown>; header: Record<string, unknown> } {
    const pem = jwkToPem(key);
    const data = `${parts[0]}.${parts[1]}`;
    const signature = Buffer.from(parts[2], "base64url");

    const verifier = createVerify("RSA-SHA256");
    verifier.update(data);
    const valid = verifier.verify(pem, signature);

    if (!valid) throw new Error("Invalid signature");
    return { payload, header };
  }

  private async getKeys(): Promise<JWK[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL) {
      return this.cache.keys;
    }

    const res = await fetch(this.jwksUrl, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

    let data: { keys: JWK[] };
    try {
      data = (await res.json()) as { keys: JWK[] };
    } catch {
      throw new Error("JWKS response is not valid JSON");
    }

    this.cache = { keys: data.keys, fetchedAt: Date.now() };
    return data.keys;
  }
}

// ── JWK → PEM 변환 (RSA 공개키) ───────────────────────

/** JWK RSA 공개키를 PEM 형식으로 변환 */
function jwkToPem(jwk: JWK): string {
  const n = Buffer.from(jwk.n, "base64url");
  const e = Buffer.from(jwk.e, "base64url");

  // INTEGER for n (high bit 세팅 시 leading zero 추가)
  const nInt =
    n[0] & 0x80
      ? Buffer.concat([
          Buffer.from([0x02]),
          encodeLength(n.length + 1),
          Buffer.from([0x00]),
          n,
        ])
      : Buffer.concat([Buffer.from([0x02]), encodeLength(n.length), n]);

  // INTEGER for e
  const eInt =
    e[0] & 0x80
      ? Buffer.concat([
          Buffer.from([0x02]),
          encodeLength(e.length + 1),
          Buffer.from([0x00]),
          e,
        ])
      : Buffer.concat([Buffer.from([0x02]), encodeLength(e.length), e]);

  // SEQUENCE { n, e }
  const seq = Buffer.concat([nInt, eInt]);
  const rsaPub = Buffer.concat([
    Buffer.from([0x30]),
    encodeLength(seq.length),
    seq,
  ]);

  // BIT STRING wrapping
  const bitString = Buffer.concat([
    Buffer.from([0x03]),
    encodeLength(rsaPub.length + 1),
    Buffer.from([0x00]),
    rsaPub,
  ]);

  // rsaEncryption OID (1.2.840.113549.1.1.1)
  const algId = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);

  // 최종 SEQUENCE { algorithmIdentifier, subjectPublicKey }
  const outer = Buffer.concat([algId, bitString]);
  const der = Buffer.concat([
    Buffer.from([0x30]),
    encodeLength(outer.length),
    outer,
  ]);

  const b64 = der.toString("base64");
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

/** ASN.1 DER 길이 인코딩 */
function encodeLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}
