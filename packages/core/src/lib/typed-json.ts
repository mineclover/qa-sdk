/**
 * DB JSON 컬럼의 타입-안전 파싱 유틸.
 *
 * drizzle text() 컬럼에 저장된 JSON을 파싱할 때 타입을 보존한다.
 * 파싱 실패 시 fallback 반환 (서비스 중단 방지).
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

/** 배열 JSON 컬럼 파싱 */
export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  return parseJsonColumn<T[]>(raw, []);
}

/** 객체 JSON 컬럼 파싱 */
export function parseJsonObject<T extends Record<string, unknown>>(raw: string | null | undefined): T {
  return parseJsonColumn<T>(raw, {} as T);
}
