// @def.boundary convergence-comparators
/**
 * 심볼 비교 — 축/prefix 간 중복을 감지한다.
 *
 * @layer 비교 (Comparison)
 */

import type { GraphPort } from "spec-schema";
import type { AxisOverlap, PrefixOverlap } from "./convergence.types.js";

/**
 * 두 축의 entries 중복을 비교한다.
 * entries는 DKG에 없으므로 외부에서 제공받는다.
 *
 * @param sharedPrefixIds - 두 축이 모두 사용되는 prefix ID 목록.
 *   같은 prefix 안에서 중복이면 merge 대신 alias(이름 정리) 추천.
 */
export function compareAxes(
  aId: string,
  aEntries: readonly string[],
  bId: string,
  bEntries: readonly string[],
  sharedPrefixIds?: readonly string[],
): AxisOverlap {
  const setA = new Set(aEntries);
  const setB = new Set(bEntries);

  const shared = aEntries.filter(e => setB.has(e));
  const aOnly = aEntries.filter(e => !setB.has(e));
  const bOnly = bEntries.filter(e => !setA.has(e));

  const unionSize = new Set([...aEntries, ...bEntries]).size;
  const overlapRatio = unionSize > 0 ? shared.length / unionSize : 0;

  let recommendation: AxisOverlap["recommendation"];
  let reason: string;

  if (overlapRatio >= 0.7) {
    // 같은 prefix에서 사용되면 → alias (이름 정리)
    if (sharedPrefixIds && sharedPrefixIds.length > 0) {
      recommendation = "alias";
      reason = `높은 중복 (${(overlapRatio * 100).toFixed(0)}%) + 같은 prefix(${sharedPrefixIds.join(", ")})에서 사용. 이름 정리 권장.`;
    } else {
      recommendation = "merge";
      reason = `높은 중복 (${(overlapRatio * 100).toFixed(0)}%). 병합 검토 권장.`;
    }
  } else if (overlapRatio >= 0.3) {
    recommendation = "review";
    reason = `중간 중복 (${(overlapRatio * 100).toFixed(0)}%). 인간 확인 필요.`;
  } else if (shared.length > 0) {
    recommendation = "keep-separate";
    reason = `낮은 중복 (${shared.join(", ")}). 도메인이 다를 가능성.`;
  } else {
    recommendation = "keep-separate";
    reason = "중복 없음.";
  }

  return { a: aId, b: bId, sharedEntries: shared, aOnly, bOnly, overlapRatio, recommendation, reason };
}

/**
 * 두 prefix의 구조적 유사도를 비교한다.
 * 공유 축과 공유 참조를 기준으로 판정한다.
 */
export function comparePrefixes(
  graph: GraphPort,
  aId: string,
  bId: string,
): PrefixOverlap {
  // a의 composes 대상 (axis)
  const aAxes = graph.edgesFrom(aId, "composes")
    .filter(e => e.meta?.dimKind === "axis")
    .map(e => e.to);
  const bAxes = graph.edgesFrom(bId, "composes")
    .filter(e => e.meta?.dimKind === "axis")
    .map(e => e.to);

  const sharedAxes = aAxes.filter(a => bAxes.includes(a));

  // a의 references 대상 (prefix_ref)
  const aRefs = graph.neighbors(aId, "references");
  const bRefs = graph.neighbors(bId, "references");
  const sharedRefs = aRefs.filter(r => bRefs.includes(r));

  const allAxes = new Set([...aAxes, ...bAxes]);
  const allRefs = new Set([...aRefs, ...bRefs]);
  const totalUnique = allAxes.size + allRefs.size;
  const sharedCount = sharedAxes.length + sharedRefs.length;
  const structuralSimilarity = totalUnique > 0 ? sharedCount / totalUnique : 0;

  let recommendation: PrefixOverlap["recommendation"];
  let reason: string;

  if (structuralSimilarity >= 0.7) {
    recommendation = "merge";
    reason = `높은 구조적 유사도 (${(structuralSimilarity * 100).toFixed(0)}%). 병합 검토 권장.`;
  } else if (structuralSimilarity >= 0.3) {
    recommendation = "review";
    reason = `중간 유사도 (${(structuralSimilarity * 100).toFixed(0)}%). 인간 확인 필요.`;
  } else {
    recommendation = "keep-separate";
    reason = `낮은 유사도 (${(structuralSimilarity * 100).toFixed(0)}%). 별개 도메인.`;
  }

  return { a: aId, b: bId, sharedAxes, sharedRefs, structuralSimilarity, recommendation, reason };
}

/**
 * DKG의 모든 축 쌍에서 중복 후보를 찾는다.
 * graph에서 prefix-axis 관계를 추출하여 alias 판정에 활용한다.
 */
export function scanAxisOverlaps(
  graph: GraphPort,
  entriesMap: ReadonlyMap<string, readonly string[]>,
): AxisOverlap[] {
  const axes = graph.getNodesByKind("axis").map(n => n.id);
  const results: AxisOverlap[] = [];

  // 축 → 해당 축을 사용하는 prefix 목록
  const axisToPrefixes = new Map<string, string[]>();
  for (const prefix of graph.getNodesByKind("prefix")) {
    const composedAxes = graph.edgesFrom(prefix.id, "composes")
      .filter(e => e.meta?.dimKind === "axis")
      .map(e => e.to);
    for (const axisId of composedAxes) {
      const arr = axisToPrefixes.get(axisId) ?? [];
      arr.push(prefix.id);
      axisToPrefixes.set(axisId, arr);
    }
  }

  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const aEntries = entriesMap.get(axes[i]);
      const bEntries = entriesMap.get(axes[j]);
      if (!aEntries || !bEntries) continue;

      // 두 축이 모두 사용되는 prefix
      const aPrefixes = new Set(axisToPrefixes.get(axes[i]) ?? []);
      const sharedPrefixIds = (axisToPrefixes.get(axes[j]) ?? []).filter(p => aPrefixes.has(p));

      const overlap = compareAxes(axes[i], aEntries, axes[j], bEntries, sharedPrefixIds);
      if (overlap.sharedEntries.length > 0) {
        results.push(overlap);
      }
    }
  }

  return results;
}
