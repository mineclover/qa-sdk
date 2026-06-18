// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * converge-chain — 수렴/분기정리/선택지정리/관측 행위 체인.
 *
 * convergence 패키지의 분석기를 직접 import하지 않고, catalog와 UsageData 호환
 * shape만으로 CLI skill이 기대하는 action summary를 계산한다.
 */

import type { Catalog } from "@qa-sdk/core";
import type { GraphPort } from "spec-schema";
import type { DecisionNode, ObservationNode } from "../dkg.types.js";
import type { UsageData } from "../store/usage-types.js";
import { scaffoldDecision } from "./decision-scaffold.js";

export type AxisOverlap = {
  readonly kind: "axis";
  readonly a: string;
  readonly b: string;
  readonly sharedEntries: readonly string[];
  readonly overlapRatio: number;
  readonly recommendation: "merge" | "keep-separate";
};

export type PrefixOverlap = {
  readonly kind: "prefix";
  readonly a: string;
  readonly b: string;
  readonly overlapRatio: number;
  readonly recommendation: "merge" | "keep-separate";
};

export type ConvergeAction =
  | { readonly kind: "merge"; readonly targets: readonly string[]; readonly overlap: AxisOverlap | PrefixOverlap }
  | { readonly kind: "deactivate"; readonly axis: string; readonly entries: readonly string[]; readonly reason: string }
  | { readonly kind: "simplify"; readonly prefix: string; readonly suggestion: string }
  | { readonly kind: "observe"; readonly finding: string; readonly source: string };

export interface ConvergeChainResult {
  readonly actions: readonly ConvergeAction[];
  readonly observations: readonly ObservationNode[];
  readonly decisions: readonly DecisionNode[];
  readonly summary: {
    readonly merges: number;
    readonly deactivations: number;
    readonly simplifications: number;
    readonly observations: number;
  };
}

export function convergeChain(
  catalog: Catalog,
  graph: GraphPort,
  usage: UsageData | null,
  options?: { date?: string; entriesMap?: ReadonlyMap<string, readonly string[]> },
): ConvergeChainResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const actions: ConvergeAction[] = [];
  const observations: ObservationNode[] = [];
  const decisions: DecisionNode[] = [];
  const entriesMap = options?.entriesMap ?? buildEntriesMap(catalog);

  for (const overlap of scanAxisOverlaps(entriesMap)) {
    if (hasActiveSeparationDecision(graph, overlap.a, overlap.b)) continue;
    actions.push({ kind: "merge", targets: [overlap.a, overlap.b], overlap });
    decisions.push(scaffoldDecision({
      type: "merge",
      id: `DEC-MERGE-${overlap.a}-${overlap.b}`,
      date,
      title: `${overlap.a}와 ${overlap.b} 병합 검토`,
      params: { targets: [overlap.a, overlap.b], into: overlap.a, overlapEntries: [...overlap.sharedEntries] },
      rationale: `Jaccard 유사도 ${(overlap.overlapRatio * 100).toFixed(0)}%. 공유 entries: ${overlap.sharedEntries.join(", ")}`,
    }));
  }

  if (usage) {
    const totalsByPrefix = new Map<string, number>();
    for (const entry of usage.entryUsages) {
      totalsByPrefix.set(entry.prefixId, (totalsByPrefix.get(entry.prefixId) ?? 0) + entry.count);
    }

    for (const entry of usage.entryUsages) {
      const total = totalsByPrefix.get(entry.prefixId) ?? 0;
      const usageRate = total > 0 ? entry.count / total : 0;
      if (usageRate > 0 && usageRate < 0.01) {
        actions.push({
          kind: "deactivate",
          axis: entry.prefixId,
          entries: [entry.entryId],
          reason: `Usage rate ${(usageRate * 100).toFixed(2)}% — 실질적 미사용`,
        });
      }
    }

    for (const [prefixId, entries] of groupEntriesByPrefix(usage.entryUsages)) {
      if (entries.size === 1 && (catalog.prefixes[prefixId]?.labels.length ?? 0) > 1) {
        const only = [...entries][0] ?? "";
        actions.push({
          kind: "simplify",
          prefix: prefixId,
          suggestion: `관측 entry가 "${only}" 하나뿐임 → 단일값 차원 또는 테스트 편향 검토`,
        });
      }
    }

    for (const skew of usage.versionUsages) {
      const obs: ObservationNode = {
        kind: "observation",
        id: `OBS-SKEW-${skew.prefix}`,
        date,
        source: "runtime",
        subjects: [skew.prefix],
        finding: `${skew.prefix}:${skew.version} observed ${skew.count} times (lastSeen=${skew.lastSeen})`,
        intent: "monitoring",
      };
      observations.push(obs);
      actions.push({ kind: "observe", finding: obs.finding, source: "deployment-skew" });
    }
  }

  return {
    actions,
    observations,
    decisions,
    summary: {
      merges: actions.filter((action) => action.kind === "merge").length,
      deactivations: actions.filter((action) => action.kind === "deactivate").length,
      simplifications: actions.filter((action) => action.kind === "simplify").length,
      observations: actions.filter((action) => action.kind === "observe").length,
    },
  };
}

function buildEntriesMap(catalog: Catalog): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const [axisId, axis] of Object.entries(catalog.axes)) {
    const versions = Object.keys(axis.versions);
    const latest = axis.versions[versions[versions.length - 1] ?? "v1"];
    if (latest) map.set(axisId, latest.entries);
  }
  return map;
}

function scanAxisOverlaps(entriesMap: ReadonlyMap<string, readonly string[]>): AxisOverlap[] {
  const axes = [...entriesMap.entries()];
  const overlaps: AxisOverlap[] = [];
  for (let i = 0; i < axes.length; i += 1) {
    for (let j = i + 1; j < axes.length; j += 1) {
      const [a, aEntries] = axes[i]!;
      const [b, bEntries] = axes[j]!;
      const aSet = new Set(aEntries);
      const bSet = new Set(bEntries);
      const sharedEntries = [...aSet].filter((entry) => bSet.has(entry));
      const union = new Set([...aSet, ...bSet]);
      const overlapRatio = union.size > 0 ? sharedEntries.length / union.size : 0;
      if (overlapRatio >= 0.8 && sharedEntries.length > 0) {
        overlaps.push({ kind: "axis", a, b, sharedEntries, overlapRatio, recommendation: "merge" });
      }
    }
  }
  return overlaps;
}

function hasActiveSeparationDecision(graph: GraphPort, a: string, b: string): boolean {
  const candidates = [
    `DEC-SEP-${a}-${b}`,
    `DEC-SEP-${b}-${a}`,
    `DEC-MERGE-${a}-${b}`,
    `DEC-MERGE-${b}-${a}`,
  ];
  return candidates.some((id) => {
    const node = graph.getNode(id);
    return node?.kind === "decision" && (node as DecisionNode).lifecycle === "active";
  });
}

function groupEntriesByPrefix(entries: UsageData["entryUsages"]): Map<string, Set<string>> {
  const byPrefix = new Map<string, Set<string>>();
  for (const entry of entries) {
    const set = byPrefix.get(entry.prefixId) ?? new Set<string>();
    set.add(entry.entryId);
    byPrefix.set(entry.prefixId, set);
  }
  return byPrefix;
}
