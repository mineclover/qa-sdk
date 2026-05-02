// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

export function now(): string {
  return new Date().toISOString();
}

/**
 * ISO-8601 타임스탬프를 정규 형식으로 변환한다.
 *
 * 정규 형식: `YYYY-MM-DDTHH:mm:ss.mmmZ` (밀리초 3자리 + Z)
 *
 * 문제: `"10:00:00Z"` vs `"10:00:00.100Z"` — 문자열 비교 시 Z(0x5A) > .(0x2E) 이므로
 * 밀리초 없는 타임스탬프가 더 큰 값으로 정렬된다.
 * 정규화하면 `"10:00:00.000Z"` < `"10:00:00.100Z"`로 올바른 순서가 보장된다.
 */
export function normalizeTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString();
}

/**
 * 두 ISO-8601 타임스탬프를 비교한다. sort comparator용.
 * 문자열 비교가 아닌 Date 변환 비교로 밀리초 유무 차이를 안전하게 처리.
 */
export function compareTimestamps(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}
