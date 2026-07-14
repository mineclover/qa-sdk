// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * diff → VersionEvent 자동 파생.
 *
 * PrefixCodec.diff() 결과를 DKG VersionEventNode로 변환한다.
 */

import type { VersionEventNode, VersionChange } from '../dkg.types.js';

export interface DiffInput {
  readonly prefix: string;
  readonly from: string;
  readonly to: string;
  readonly changedLabels: readonly {
    readonly label: string;
    readonly fromLabelVersion: string;
    readonly fromMax: number;
    readonly toLabelVersion: string;
    readonly toMax: number;
  }[];
}

/**
 * diff 결과에서 VersionEvent를 생성한다.
 */
export function versionEventFromDiff(
  diff: DiffInput,
  meta: { date: string; note?: string },
): VersionEventNode {
  const changes: VersionChange[] = diff.changedLabels.map((cl) => {
    if (cl.toMax > cl.fromMax) {
      // entries 추가 또는 capacity 확장
      return {
        kind: cl.toMax - cl.fromMax > 1 ? 'capacity-changed' : 'entry-added',
        detail: `${cl.label} max ${cl.fromMax}→${cl.toMax} (${cl.fromLabelVersion}→${cl.toLabelVersion})`,
      } satisfies VersionChange;
    }

    if (cl.toMax < cl.fromMax) {
      return {
        kind: 'entry-deactivated',
        detail: `${cl.label} max ${cl.fromMax}→${cl.toMax} (${cl.fromLabelVersion}→${cl.toLabelVersion})`,
      } satisfies VersionChange;
    }

    // max 동일하지만 label version이 다른 경우 (entries 내용 변경)
    return {
      kind: 'entry-added',
      detail: `${cl.label} version ${cl.fromLabelVersion}→${cl.toLabelVersion} (max 동일: ${cl.toMax})`,
    } satisfies VersionChange;
  });

  const impact = deriveImpact(diff);

  return {
    kind: 'version-event',
    id: `VE-${diff.prefix}-${diff.from}-${diff.to}`,
    subjectId: diff.prefix,
    subjectKind: 'prefix',
    fromVersion: diff.from,
    toVersion: diff.to,
    date: meta.date,
    changes,
    impact,
  };
}

function deriveImpact(diff: DiffInput): string {
  if (diff.changedLabels.length === 0) {
    return 'no-impact. 변경 없음.';
  }

  const hasCapacityChange = diff.changedLabels.some((c) => c.toMax !== c.fromMax);
  const hasCapacityIncrease = diff.changedLabels.some((c) => c.toMax > c.fromMax);
  const hasCapacityDecrease = diff.changedLabels.some((c) => c.toMax < c.fromMax);

  if (!hasCapacityChange) {
    return 'state-only. label version 변경, shape 불변.';
  }

  if (hasCapacityDecrease) {
    return 'stride-break. capacity 감소. 전체 re-encode 필요.';
  }

  if (hasCapacityIncrease) {
    const parts = diff.changedLabels
      .filter((c) => c.toMax > c.fromMax)
      .map((c) => `${c.label} ${c.fromMax}→${c.toMax}`);
    return `size 변경 (${parts.join(', ')}). bitmask 재생성 필요.`;
  }

  return 'unknown impact.';
}
