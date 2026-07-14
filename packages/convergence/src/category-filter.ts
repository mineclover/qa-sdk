// @def.boundary convergence-layer-group
/**
 * Category Filter — UsageData를 schema category별로 슬라이싱.
 *
 * aggregateUsageData의 결과를 category별로 필터링한다.
 * GraphPort의 PrefixNode.category를 기준으로 분류.
 *
 * @layer 필터 (Filtering)
 */

import type { GraphPort } from 'spec-schema';
import type { UsageData } from './convergence.types.js';

/**
 * UsageData를 특정 category의 prefix만 포함하도록 필터링.
 */
export function filterUsageByCategory(
  usage: UsageData,
  graph: GraphPort,
  category: string,
): UsageData {
  const prefixIds = new Set(graph.getPrefixesByCategory(category).map((p) => p.id));

  return {
    entryUsages: usage.entryUsages, // entry는 prefix 무관하게 집계됨
    addressUsages: usage.addressUsages.filter((a) => prefixIds.has(a.prefix)),
    coOccurrences: usage.coOccurrences.filter(
      (c) => prefixIds.has(c.sourcePrefix) || prefixIds.has(c.targetPrefix),
    ),
    versionUsages: usage.versionUsages.filter((v) => prefixIds.has(v.prefix)),
    collectionPeriod: usage.collectionPeriod,
    sourceStats: usage.sourceStats,
  };
}

/**
 * UsageData를 모든 category로 분류.
 */
export function groupUsageByCategory(
  usage: UsageData,
  graph: GraphPort,
): Record<string, UsageData> {
  const groups = graph.groupPrefixesByCategory();
  const result: Record<string, UsageData> = {};

  for (const [category, prefixes] of Object.entries(groups)) {
    const prefixIds = new Set(prefixes.map((p) => p.id));

    result[category] = {
      entryUsages: usage.entryUsages,
      addressUsages: usage.addressUsages.filter((a) => prefixIds.has(a.prefix)),
      coOccurrences: usage.coOccurrences.filter(
        (c) => prefixIds.has(c.sourcePrefix) || prefixIds.has(c.targetPrefix),
      ),
      versionUsages: usage.versionUsages.filter((v) => prefixIds.has(v.prefix)),
      collectionPeriod: usage.collectionPeriod,
      sourceStats: usage.sourceStats,
    };
  }

  return result;
}

/**
 * category별 요약 통계.
 */
export function summarizeByCategory(
  usage: UsageData,
  graph: GraphPort,
): Array<{
  category: string;
  prefixCount: number;
  prefixIds: string[];
  addressCount: number;
  totalHits: number;
  versionCount: number;
}> {
  const grouped = groupUsageByCategory(usage, graph);

  return Object.entries(grouped)
    .map(([category, catUsage]) => ({
      category,
      prefixCount: new Set(catUsage.addressUsages.map((a) => a.prefix)).size,
      prefixIds: [...new Set(catUsage.addressUsages.map((a) => a.prefix))],
      addressCount: catUsage.addressUsages.length,
      totalHits: catUsage.addressUsages.reduce((s, a) => s + a.count, 0),
      versionCount: catUsage.versionUsages.length,
    }))
    .toSorted((a, b) => b.totalHits - a.totalHits);
}
