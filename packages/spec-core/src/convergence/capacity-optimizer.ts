/**
 * Capacity Optimizer — 축의 최적 capacity를 산출한다.
 *
 * 원칙:
 *   headroom 비용은 싸다 (약간 더 큰 주소 공간)
 *   stride-break 비용은 비싸다 (전체 re-encode + cascade)
 *   → 작은 값일수록 넉넉하게, 큰 값은 적당히
 *
 * 규칙:
 *   주소 공간 한계: Number.MAX_SAFE_INTEGER (2^53)
 *   전체 prefix의 shape 곱이 2^53 이내면 Number 안전. 넉넉하게 잡아도 된다.
 *
 *   최소 capacity: 16 (entries가 1~2개여도)
 *   entries ≤ 4  → capacity = 16
 *   entries ≤ 8  → capacity = 32
 *   entries ≤ 16 → capacity = 64
 *   entries ≤ 64 → capacity = 128
 *   entries > 64 → nextPowerOf2(entries * 2)
 *
 *   항상 2의 거듭제곱 (bitmask 정렬 최적)
 *   항상 entries의 최소 2~4배 headroom
 *   stride-break 1회 비용 >> headroom 비용이므로 넉넉히 잡는다
 *
 * @layer 추천 (Recommendation)
 */

import type { GraphRegistry } from "../dkg/graph-registry.js";

export interface CapacityRecommendation {
  readonly axisId: string;
  readonly currentEntries: number;
  readonly currentCapacity: number;
  readonly recommendedCapacity: number;
  readonly headroomAfter: number;
  readonly headroomRatio: number;     // headroom / capacity
  readonly changed: boolean;
  readonly reason: string;
}

export interface CapacityOptimizationReport {
  readonly recommendations: readonly CapacityRecommendation[];
  readonly summary: {
    readonly totalAxes: number;
    readonly changed: number;
    readonly unchanged: number;
    readonly totalAddressSpaceBefore: number;
    readonly totalAddressSpaceAfter: number;
  };
}

const MIN_CAPACITY = 32;

/**
 * entries 수에 따른 최적 capacity를 계산한다.
 *
 * Number.MAX_SAFE_INTEGER = 2^53 ≈ 9×10^15.
 * 실제 prefix는 2~5차원. 5차원 × capacity 256 = 256^5 ≈ 10^12 → 2^53의 0.01%.
 * 주소 공간 0.01%까지 기본으로 잡아도 안전하므로 넉넉하게 잡는다.
 *
 * stride-break 1회 비용(전체 cascade re-encode) >> headroom 비용(약간 큰 주소 공간)
 * → 충분히 커야 한다.
 *
 * 규칙:
 *   entries ≤ 8   → 32   (최소 24 headroom)
 *   entries ≤ 16  → 64   (최소 48 headroom)
 *   entries ≤ 32  → 128  (최소 96 headroom)
 *   entries ≤ 128 → 256
 *   entries ≤ 512 → 1024
 *   entries > 512 → nextPowerOf2(entries × 2)
 *
 * 현실 참고: AWS region < 100개, HTTP method < 10개, 역할 < 50개
 * 대부분의 도메인 enum은 수백 이내.
 */
export function optimalCapacity(entries: number): number {
  if (entries <= 0) return MIN_CAPACITY;
  if (entries <= 8) return 32;
  if (entries <= 16) return 64;
  if (entries <= 32) return 128;
  if (entries <= 128) return 256;
  if (entries <= 512) return 1024;
  return nextPowerOf2(entries * 2);
}

/**
 * 전체 축에 대해 capacity 최적화를 분석한다.
 */
export function optimizeCapacities(
  axisData: ReadonlyArray<{
    id: string;
    entries: number;
    capacity: number;
  }>,
): CapacityOptimizationReport {
  const recommendations: CapacityRecommendation[] = [];
  let totalBefore = 0;
  let totalAfter = 0;
  let changed = 0;

  for (const axis of axisData) {
    const recommended = optimalCapacity(axis.entries);
    // 이미 충분하면 건들지 않음 (기존 capacity가 recommended 이상이고 2의 거듭제곱이면)
    const alreadyGood = axis.capacity >= recommended && isPowerOf2(axis.capacity);
    const finalCapacity = alreadyGood ? axis.capacity : Math.max(recommended, axis.capacity);

    const isChanged = finalCapacity !== axis.capacity;
    if (isChanged) changed++;

    const headroomAfter = finalCapacity - axis.entries;

    recommendations.push({
      axisId: axis.id,
      currentEntries: axis.entries,
      currentCapacity: axis.capacity,
      recommendedCapacity: finalCapacity,
      headroomAfter,
      headroomRatio: finalCapacity > 0 ? headroomAfter / finalCapacity : 0,
      changed: isChanged,
      reason: isChanged
        ? `${axis.capacity}→${finalCapacity} (headroom ${axis.capacity - axis.entries}→${headroomAfter})`
        : `유지 (headroom ${headroomAfter} 충분)`,
    });

    totalBefore += axis.capacity;
    totalAfter += finalCapacity;
  }

  return {
    recommendations,
    summary: {
      totalAxes: axisData.length,
      changed,
      unchanged: axisData.length - changed,
      totalAddressSpaceBefore: totalBefore,
      totalAddressSpaceAfter: totalAfter,
    },
  };
}

/**
 * cascade 영향을 고려한 최적화 보고서를 생성한다.
 * 각 축 변경이 몇 개의 prefix에 cascade하는지 표시.
 */
export function optimizeWithImpact(
  axisData: ReadonlyArray<{
    id: string;
    entries: number;
    capacity: number;
  }>,
  graph: GraphRegistry,
): CapacityOptimizationReport & {
  readonly impactDetails: ReadonlyArray<{
    axisId: string;
    affectedPrefixes: number;
    cascadeDepth: number;
  }>;
} {
  const base = optimizeCapacities(axisData);

  const impactDetails = base.recommendations
    .filter(r => r.changed)
    .map(r => {
      const cascade = graph.cascadeFromAxis(r.axisId);
      return {
        axisId: r.axisId,
        affectedPrefixes: cascade.length,
        cascadeDepth: cascade.length > 0 ? Math.max(...cascade.map(c => c.distance)) : 0,
      };
    });

  return { ...base, impactDetails };
}

function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function nextPowerOf2(n: number): number {
  let v = n - 1;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  return v + 1;
}
