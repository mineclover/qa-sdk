// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * Read-side projection for bitmap issuance — write entity 가 없으므로
 * domain types 만 노출한다.
 *
 * issuedAt/expiresAt 은 ISO-8601 문자열 (permission-engine 의 VersionedBitmap
 * 컨벤션과 동일).
 */
export interface BitmapIssueResult {
  readonly prefix: string;
  readonly v: string;
  readonly mask: Uint8Array;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly issuer: string;
  readonly signature: string;
}

/** UI/와이어 직렬화 형 — mask 를 base64 로 인코드. */
export interface BitmapIssueWireResult {
  readonly prefix: string;
  readonly v: string;
  readonly maskBase64: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly issuer: string;
  readonly signature: string;
}
