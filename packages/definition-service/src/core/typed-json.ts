// @def.doc definition-service

/**
 * 타입 안전 JSON 컬럼 파싱 헬퍼
 *
 * SQLite TEXT 컬럼에 저장된 JSON 문자열을 안전하게 파싱한다.
 * null/undefined/빈 문자열 처리 + JSON.parse 실패 시 기본값 반환.
 */

/** JSON 배열 컬럼 파싱 — 실패 시 빈 배열 반환 */
export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

/** JSON 객체 컬럼 파싱 — 실패 시 빈 객체 반환 */
export function parseJsonObject<T extends Record<string, unknown>>(
  raw: string | null | undefined,
): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
