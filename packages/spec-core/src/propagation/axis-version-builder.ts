/**
 * axis-version-builder — 축 버전 파생.
 *
 * 기존 AxisVersionSnapshot에 entry를 추가/제거하여 새 버전을 생성한다.
 * 순수 함수 — 부수 효과 없음.
 */

export interface AxisVersionSnapshot {
  readonly entries: readonly string[];
  readonly capacity?: number;
  readonly ko?: Record<string, string>;
}

export interface VersionedAxis {
  readonly versions: Record<string, AxisVersionSnapshot>;
}

/** 현재 최신 버전 키를 반환한다. */
export function latestVersionKey(axis: VersionedAxis): string {
  const keys = Object.keys(axis.versions);
  return keys[keys.length - 1] ?? "v1";
}

/** 다음 버전 키를 파생한다. "v3" → "v4" */
export function nextVersionKey(axis: VersionedAxis): string {
  const keys = Object.keys(axis.versions);
  const maxNum = keys.reduce((max, k) => {
    const m = k.match(/^v(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `v${maxNum + 1}`;
}

/** prefix 버전 문자열을 1 증가시킨다. "v2" → "v3" */
export function bumpVersionString(version: string): string {
  const m = version.match(/^v(\d+)$/);
  return m ? `v${parseInt(m[1], 10) + 1}` : `${version}.1`;
}

/** 기존 snapshot에 entry를 추가한 새 snapshot을 반환한다. */
export function createAxisVersion(
  base: AxisVersionSnapshot,
  additions: readonly string[],
): AxisVersionSnapshot {
  const existing = new Set(base.entries);
  const newEntries = additions.filter((e) => !existing.has(e));
  if (newEntries.length === 0) return base;

  return {
    entries: [...base.entries, ...newEntries],
    capacity: base.capacity,
    ko: base.ko ? { ...base.ko } : undefined,
  };
}
