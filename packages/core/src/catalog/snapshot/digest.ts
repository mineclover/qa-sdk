// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { Catalog } from '../catalog.types.js';
import { canonicalJson } from './canonical-json.js';

/** digest 산출 규칙 식별자 — CatalogSnapshot.digestAlgorithm에 기록 */
export const CATALOG_DIGEST_ALGORITHM = 'sha256-jcs' as const;

const DIGEST_PREFIX = 'sha256:';
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** UTF-8 문자열의 SHA-256 hex. 브라우저·Node 공통 WebCrypto만 사용한다. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('digest 계산에 WebCrypto(crypto.subtle)가 필요합니다');
  }
  const bytes = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** canonicalJson 직렬화 결과의 digest (`sha256:<64 hex>`) */
export async function digestCanonical(value: unknown): Promise<string> {
  return `${DIGEST_PREFIX}${await sha256Hex(canonicalJson(value))}`;
}

/** Catalog 전체 내용의 digest — 표시 이름 변경도 반영된다. layout 호환성은 layoutDigest로 판정한다. */
export function computeCatalogDigest(catalog: Catalog): Promise<string> {
  return digestCanonical(catalog);
}

/** 로그·UI 표시용 12 hex. 식별·비교에는 전체 digest를 쓴다. */
export function shortDigest(digest: string): string {
  if (!DIGEST_PATTERN.test(digest)) {
    throw new TypeError(`digest 형식이 아닙니다: ${digest}`);
  }
  return digest.slice(DIGEST_PREFIX.length, DIGEST_PREFIX.length + 12);
}
