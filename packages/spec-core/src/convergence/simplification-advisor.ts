/**
 * 최소 가짓수 유지 — prefix의 불필요한 복잡도를 감지한다.
 */

import type { GraphRegistry } from "../dkg/graph-registry.js";
import type { PrefixNode } from "../dkg/dkg.types.js";
import type {
  EntryUsage,
  AddressUsage,
  SimplificationCandidate,
  SimplificationSuggestion,
} from "./convergence.types.js";

const LOW_USAGE_THRESHOLD = 0.05;    // 5% 미만 → 저사용
const LOW_UTILIZATION_THRESHOLD = 0.10; // 10% 미만 → 과도한 headroom

/**
 * prefix의 단순화 기회를 분석한다.
 */
export function analyzeSimplification(
  graph: GraphRegistry,
  prefixId: string,
  entryUsages: readonly EntryUsage[],
  addressUsages: readonly AddressUsage[],
): SimplificationCandidate {
  const prefixNode = graph.getNode(prefixId) as PrefixNode | undefined;
  const dims = prefixNode?.dimLabels ?? [];

  // 주소 공간 사용률
  const prefixAddresses = addressUsages.filter(a => a.prefix === prefixId);
  const activeAddressCount = prefixAddresses.length;
  const totalCount = prefixAddresses.reduce((sum, a) => sum + a.count, 0);

  // 차원별 사용된 entry 집합
  const dimValueSets = new Map<string, Set<string>>();
  for (const usage of entryUsages) {
    // entryUsage의 axisId가 이 prefix의 차원인지 확인
    if (dims.includes(usage.axisId) || isAxisOfPrefix(graph, prefixId, usage.axisId)) {
      const set = dimValueSets.get(usage.axisId) ?? new Set();
      if (usage.count > 0) set.add(usage.entry);
      dimValueSets.set(usage.axisId, set);
    }
  }

  // 단일 값 차원 (모든 관측에서 1개 값만 사용)
  const singleValueDims: { dim: string; value: string }[] = [];
  for (const [dim, values] of dimValueSets) {
    if (values.size === 1) {
      singleValueDims.push({ dim, value: [...values][0] });
    }
  }

  // 저사용 entry
  const totalEntryCount = entryUsages
    .filter(u => dims.includes(u.axisId) || isAxisOfPrefix(graph, prefixId, u.axisId))
    .reduce((sum, u) => sum + u.count, 0);

  const lowUsageEntries: { axis: string; entry: string; usageRate: number }[] = [];
  if (totalEntryCount > 0) {
    for (const usage of entryUsages) {
      if (!dims.includes(usage.axisId) && !isAxisOfPrefix(graph, prefixId, usage.axisId)) continue;
      const rate = usage.count / totalEntryCount;
      if (rate < LOW_USAGE_THRESHOLD && usage.count > 0) {
        lowUsageEntries.push({ axis: usage.axisId, entry: usage.entry, usageRate: rate });
      }
    }
  }

  // addressSpaceSize 추정 (실제로는 shape 곱이지만 관측 기반으로 추정)
  const addressSpaceSize = Math.max(activeAddressCount * 10, 1); // 추정

  const utilizationRate = addressSpaceSize > 0 ? activeAddressCount / addressSpaceSize : 0;

  // 제안 생성
  const suggestions: SimplificationSuggestion[] = [];

  for (const sv of singleValueDims) {
    suggestions.push({
      kind: "remove-dim",
      dim: sv.dim,
      reason: `'${sv.dim}' 차원이 항상 '${sv.value}'만 사용됨. 차원 제거 검토.`,
    });
  }

  for (const le of lowUsageEntries) {
    suggestions.push({
      kind: "deactivate-entry",
      axis: le.axis,
      entry: le.entry,
      reason: `'${le.axis}:${le.entry}' 사용률 ${(le.usageRate * 100).toFixed(1)}%. 비활성화 검토.`,
    });
  }

  if (dims.length > 6) {
    suggestions.push({
      kind: "split-prefix",
      newPrefixes: [],
      reason: `차원 수 ${dims.length}개 — 복잡도 높음. 분할 검토.`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({ kind: "ok", reason: "단순화 불필요." });
  }

  return {
    prefix: prefixId,
    addressSpaceSize,
    activeAddressCount,
    utilizationRate,
    singleValueDims,
    lowUsageEntries,
    suggestions,
  };
}

function isAxisOfPrefix(graph: GraphRegistry, prefixId: string, axisId: string): boolean {
  return graph.edgesFrom(prefixId, "composes").some(e => e.to === axisId);
}
