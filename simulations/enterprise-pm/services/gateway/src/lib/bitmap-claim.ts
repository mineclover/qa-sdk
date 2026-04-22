// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * VersionedBitmap ↔ JWT claim 직렬화.
 *
 * §2 bitmap-pipeline §3 (저장·전달):
 *   bitmap mask는 binary (Uint8Array). JWT body는 JSON 텍스트.
 *   → base64 인코딩으로 텍스트화. claim key는 `bitmap_*` prefix.
 *
 * issuedAt / expiresAt은 JWT의 `iat` / `exp` claim과 별도 — VersionedBitmap의
 * 자체 timestamp이므로 JWT issue 시 동기화 (jose가 iat/exp를 자동 설정).
 */

import type { VersionedBitmap } from "permission-engine";

export interface BitmapClaim {
  bitmap_prefix: string;
  bitmap_v: string;
  /** Uint8Array → base64 (표준 인코딩, padding 포함). */
  bitmap_mask: string;
  bitmap_issuer: string;
  bitmap_signature: string;
}

export function bitmapToClaim(bm: VersionedBitmap): BitmapClaim {
  return {
    bitmap_prefix: bm.prefix,
    bitmap_v: bm.v,
    bitmap_mask: Buffer.from(bm.mask).toString("base64"),
    bitmap_issuer: bm.issuer,
    bitmap_signature: bm.signature,
  };
}

/**
 * JWT body의 claim에서 VersionedBitmap을 복원한다.
 * issuedAt/expiresAt은 JWT의 iat/exp에서 ISO-8601로 변환되어 별도 인자로 주입.
 */
export function claimToBitmap(
  claim: Partial<BitmapClaim>,
  issuedAt: string,
  expiresAt: string,
): VersionedBitmap {
  const required: Array<keyof BitmapClaim> = [
    "bitmap_prefix",
    "bitmap_v",
    "bitmap_mask",
    "bitmap_issuer",
    "bitmap_signature",
  ];
  for (const key of required) {
    const v = claim[key];
    if (typeof v !== "string" || v === "") {
      throw new Error(`bitmap claim required field missing: ${key}`);
    }
  }
  const maskB64 = claim.bitmap_mask!;
  // base64 표준 문자 + padding만 허용. 그 외는 invalid로 간주.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(maskB64)) {
    throw new Error(`invalid base64 in bitmap_mask`);
  }
  const buf = Buffer.from(maskB64, "base64");
  // re-encode 후 비교해서 decode-encode 왕복이 동일한지 검증 (padding 차이 허용).
  const norm = (s: string): string => s.replace(/=+$/, "");
  if (norm(buf.toString("base64")) !== norm(maskB64)) {
    throw new Error(`invalid base64 in bitmap_mask`);
  }
  const mask = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    prefix: claim.bitmap_prefix!,
    v: claim.bitmap_v!,
    mask,
    issuedAt,
    expiresAt,
    issuer: claim.bitmap_issuer!,
    signature: claim.bitmap_signature!,
  };
}
