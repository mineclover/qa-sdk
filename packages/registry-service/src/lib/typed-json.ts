// @def.boundary registry-system
// @def.doc registry-system

/**
 * DB JSON 컬럼의 타입-안전 파싱 유틸.
 *
 * SqlDriver query 결과의 JSON 문자열을 파싱할 때 타입을 보존한다.
 */

/** JSON 문자열을 타입-안전하게 파싱. 실패 시 fallback 반환 */
export function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
