/**
 * converge-chain — 수렴/분기정리/선택지정리/관측 4가지 행위 체인.
 *
 * 각 행위가 명확히 구분되고, 발견 → Decision → 실행까지 체인된다.
 */

import type { Catalog } from "@qa-sdk/core";
import type { GraphPort, UsageData, AxisOverlap, PrefixOverlap } from "@qa-sdk/convergence";
import type { ObservationNode, DecisionNode } from "../dkg.types.js";
import { scanAxisOverlaps, comparePrefixes, analyzeSimplification, discoverCausality, analyzeDeploymentSkew } from "@qa-sdk/convergence";
import { scaffoldDecision } from "./decision-scaffold.js";

// ═══════════════════════════════════════════════════════════════
//  Action 구분 — 4가지 행위
// ═══════════════════════════════════════════════════════════════

export type ConvergeAction =
  | { kind: "merge"; targets: string[]; overlap: AxisOverlap | PrefixOverlap }
  | { kind: "deactivate"; axis: string; entries: string[]; reason: string }
  | { kind: "simplify"; prefix: string; suggestion: string }
  | { kind: "observe"; finding: string; source: string };

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

/**
 * 기존 DEC-SEP / DEC-MERGE(분리 유지) 결정이 활성 상태로 존재하는지 확인.
 * DEC-SEP-{a}-{b} 또는 DEC-MERGE-{a}-{b} (양방향) 중 하나라도 있으면 true.
 */
function hasActiveSeparationDecision(graph: GraphPort, a: string, b: string): boolean {
  const candidates = [
    `DEC-SEP-${a}-${b}`, `DEC-SEP-${b}-${a}`,
    `DEC-MERGE-${a}-${b}`, `DEC-MERGE-${b}-${a}`,
  ];
  return candidates.some(id => {
    const node = graph.getNode(id);
    if (!node || node.kind !== "decision") return false;
    const dec = node as DecisionNode;
    // 활성 결정만 억제. superseded/reversed된 결정은 재검토 허용.
    return dec.lifecycle === "active";
  });
}

/**
 * 4가지 행위를 한 번에 실행하고 결과를 구분하여 반환한다.
 *
 * 1. 수렴 (merge) — 축/prefix 중복 발견 → 병합 Decision (기존 분리 결정 시 억제)
 * 2. 분기 정리 (deactivate) — dormant entry → 비활성화 Decision
 * 3. 선택지 정리 (simplify) — 단일값 차원, 과도한 복잡도 → 단순화 Decision
 * 4. 관측 (observe) — 인과 발견, 배포 스큐 → Observation 생성
 */
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

  // ── 1. 수렴 (merge) ────────────────────────────────

  if (options?.entriesMap) {
    const overlaps = scanAxisOverlaps(graph, options.entriesMap);
    for (const o of overlaps) {
      if (o.recommendation === "merge") {
        // 기존 DEC-SEP 분리 결정이 있으면 이미 검토된 건으로 건너뜀
        if (hasActiveSeparationDecision(graph, o.a, o.b)) continue;

        actions.push({ kind: "merge", targets: [o.a, o.b], overlap: o });

        decisions.push(scaffoldDecision({
          type: "merge",
          id: `DEC-MERGE-${o.a}-${o.b}`,
          date,
          title: `${o.a}와 ${o.b} 병합 검토`,
          params: { targets: [o.a, o.b], into: o.a, overlapEntries: [...o.sharedEntries] },
          rationale: `Jaccard 유사도 ${(o.overlapRatio * 100).toFixed(0)}%. 공유 entries: ${o.sharedEntries.join(", ")}`,
        }));
      }
    }
  }

  // prefix 유사도
  const prefixIds = graph.getNodesByKind("prefix").map(n => n.id);
  for (let i = 0; i < prefixIds.length; i++) {
    for (let j = i + 1; j < prefixIds.length; j++) {
      const overlap = comparePrefixes(graph, prefixIds[i], prefixIds[j]);
      if (overlap.recommendation === "merge") {
        // 기존 DEC-SEP 분리 결정이 있으면 건너뜀
        if (hasActiveSeparationDecision(graph, overlap.a, overlap.b)) continue;

        actions.push({ kind: "merge", targets: [overlap.a, overlap.b], overlap });
      }
    }
  }

  // ── 2. 분기 정리 (deactivate) ──────────────────────

  if (usage) {
    for (const prefixId of prefixIds) {
      const simplification = analyzeSimplification(
        graph, prefixId, usage.entryUsages, usage.addressUsages,
      );

      for (const entry of simplification.lowUsageEntries) {
        if (entry.usageRate < 0.01) { // 1% 미만
          actions.push({
            kind: "deactivate",
            axis: entry.axis,
            entries: [entry.entry],
            reason: `Usage rate ${(entry.usageRate * 100).toFixed(2)}% — 실질적 미사용`,
          });
        }
      }

      // ── 3. 선택지 정리 (simplify) ────────────────────

      for (const sv of simplification.singleValueDims) {
        actions.push({
          kind: "simplify",
          prefix: prefixId,
          suggestion: `${sv.dim} 차원이 항상 "${sv.value}"만 사용 → 차원 제거 검토`,
        });
      }

      for (const s of simplification.suggestions) {
        if (s.kind === "split-prefix") {
          actions.push({
            kind: "simplify",
            prefix: prefixId,
            suggestion: `차원 수 과다 → prefix 분할 검토`,
          });
        }
      }
    }

    // ── 4. 관측 (observe) ─────────────────────────────

    // 인과 발견
    const causal = discoverCausality(graph, usage.coOccurrences);
    for (const c of causal) {
      const obs: ObservationNode = {
        kind: "observation",
        id: `OBS-CAUSAL-${c.source.prefix}-${c.target.prefix}`,
        date,
        source: "metric",
        subjects: [c.source.prefix, c.target.prefix],
        finding: `${c.source.prefix}:${c.source.entry} → ${c.target.prefix}:${c.target.entry} (rate ${(c.coOccurrenceRate * 100).toFixed(1)}%, ${c.observedCount}건)`,
        suggestion: c.suggestion === "intent-link"
          ? { kind: "add-constraint", rule: `${c.source.entry} → ${c.target.entry} 인과 관계 공식화` }
          : undefined,
      };
      observations.push(obs);
      actions.push({ kind: "observe", finding: obs.finding, source: "causal-discovery" });
    }

    // 배포 스큐
    if (usage.versionUsages.length > 0) {
      const skews = analyzeDeploymentSkew(usage.versionUsages);
      for (const s of skews) {
        if (s.severity !== "ok") {
          const obs: ObservationNode = {
            kind: "observation",
            id: `OBS-SKEW-${s.prefix}`,
            date,
            source: "runtime",
            subjects: [s.prefix],
            finding: s.summary,
          };
          observations.push(obs);
          actions.push({ kind: "observe", finding: s.summary, source: "deployment-skew" });
        }
      }
    }
  }

  return {
    actions,
    observations,
    decisions,
    summary: {
      merges: actions.filter(a => a.kind === "merge").length,
      deactivations: actions.filter(a => a.kind === "deactivate").length,
      simplifications: actions.filter(a => a.kind === "simplify").length,
      observations: actions.filter(a => a.kind === "observe").length,
    },
  };
}
