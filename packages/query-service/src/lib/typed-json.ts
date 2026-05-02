// @def.boundary query-api-spec
// @def.doc query-api-spec

/**
 * DB JSON 컬럼의 타입-안전 파싱 유틸.
 */

/** JSON 문자열을 타입-안전하게 파싱. 실패 시 fallback 반환 */
export function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
