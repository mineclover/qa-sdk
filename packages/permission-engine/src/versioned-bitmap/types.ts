// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * VersionedBitmap — 서명된, TTL 있는, version-bound bitmap.
 *
 * 주소 공간 자체는 DisjointUnionIndex로 구성되지만, 본 타입은 그 mask에
 * 무결성(signature) + freshness(expiresAt) + version binding(prefix, v)를 부여한다.
 *
 * 3축 무결성:
 *   - Integrity: HMAC 서명으로 변조 방지
 *   - Freshness: expiresAt으로 시간 만료
 *   - Version binding: (prefix, v)로 shape 스냅샷 고정
 */

export interface VersionedBitmap {
  /** 좌표 네임스페이스 (예: "perm"). */
  prefix: string;
  /** shape 스냅샷 식별자 (예: "uv1"). DisjointUnionIndex의 variant 구성을 포함. */
  v: string;
  /** 실제 비트맵. 크기는 ⌈totalSize / 8⌉ 바이트. */
  mask: Uint8Array;
  /** ISO-8601 발급 시각. */
  issuedAt: string;
  /** ISO-8601 만료 시각. */
  expiresAt: string;
  /** 발급 주체 식별자. */
  issuer: string;
  /** HMAC-SHA256 hex (§verification 참조). */
  signature: string;
}

export interface IssueArgs {
  prefix: string;
  v: string;
  mask: Uint8Array;
  issuer: string;
  /** TTL milliseconds (양수). */
  ttlMs: number;
  /** HMAC secret. 최소 32 바이트 권장. */
  secret: Uint8Array;
  /** 주입 시각 (테스트용). 없으면 Date.now(). */
  now?: number;
}

export interface VerifyArgs {
  bitmap: VersionedBitmap;
  secret: Uint8Array;
  /** 검증 시각 (테스트용). 없으면 Date.now(). */
  now?: number;
  /**
   * dual-accept 기간의 이전 secret들. secret rotation 중 구 서명을 한시적으로 허용.
   * 배열 순서대로 시도.
   */
  previousSecrets?: readonly Uint8Array[];
}

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailureReason };

export type VerifyFailureReason = 'signature_mismatch' | 'expired' | 'invalid_format';
