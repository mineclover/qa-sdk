/**
 * 인과 발견 — co-occurrence에서 인과 관계 후보를 추출한다.
 *
 * @layer 비교 (Comparison)
 */

import type { GraphRegistry } from "../dkg/graph-registry.js";
import type { ObservationNode } from "../dkg/dkg.types.js";
import type { CoOccurrence, CausalCandidate } from "./convergence.types.js";

/**
 * co-occurrence 데이터에서 인과 후보를 추출한다.
 * 이미 IntentLink로 등록된 쌍은 제외한다.
 */
export function discoverCausality(
  graph: GraphRegistry,
  coOccurrences: readonly CoOccurrence[],
): CausalCandidate[] {
  const candidates: CausalCandidate[] = [];

  for (const co of coOccurrences) {
    if (co.totalSourceCount === 0) continue;

    const rate = co.count / co.totalSourceCount;

    // 이미 IntentLink가 있는지 확인
    const existingLinks = graph.intentLinksFor(co.sourcePrefix);
    const alreadyLinked = existingLinks.some(l =>
      l.intent.includes(co.sourceEntry) && l.intent.includes(co.targetEntry),
    );
    if (alreadyLinked) continue;

    let confidence: CausalCandidate["confidence"];
    let suggestion: CausalCandidate["suggestion"];

    if (rate >= 0.95 && co.count >= 1000) {
      confidence = "high";
      suggestion = "intent-link";
    } else if (rate >= 0.80 && co.count >= 500) {
      confidence = "medium";
      suggestion = "constraint";
    } else if (rate >= 0.50 && co.count >= 100) {
      confidence = "low";
      suggestion = "observe-more";
    } else {
      continue; // 무시
    }

    candidates.push({
      source: { prefix: co.sourcePrefix, entry: co.sourceEntry },
      target: { prefix: co.targetPrefix, entry: co.targetEntry },
      coOccurrenceRate: rate,
      observedCount: co.count,
      confidence,
      suggestion,
    });
  }

  // confidence 높은 순 정렬
  return candidates.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);
}

/**
 * discoverCausality + Observation 노드 생성.
 * 각 후보를 DKG에 기록할 수 있는 ObservationNode로 변환한다.
 */
export function discoverCausalityWithObservations(
  graph: GraphRegistry,
  coOccurrences: readonly CoOccurrence[],
  options?: { date?: string },
): { candidates: CausalCandidate[]; observations: ObservationNode[] } {
  const candidates = discoverCausality(graph, coOccurrences);
  const date = options?.date ?? new Date().toISOString().slice(0, 10);

  const observations: ObservationNode[] = candidates.map(c => {
    const id = `OBS-CAUSAL-${c.source.prefix}-${c.source.entry}-${c.target.prefix}-${c.target.entry}`;
    const ratePercent = (c.coOccurrenceRate * 100).toFixed(1);
    const finding = `${c.source.prefix}:${c.source.entry} 후 ${ratePercent}% 확률로 ${c.target.prefix}:${c.target.entry} 발생 (${c.observedCount}건)`;

    return {
      kind: "observation" as const,
      id,
      date,
      source: "runtime" as const,
      subjects: [c.source.prefix, c.target.prefix],
      finding,
      intent: c.confidence === "high" ? "action-needed" as const : "monitoring" as const,
      ...(c.confidence !== "low" && {
        suggestion: {
          kind: c.suggestion === "intent-link" ? "add-constraint" as const : "add-constraint" as const,
          rule: `${c.source.prefix}:${c.source.entry} → ${c.target.prefix}:${c.target.entry} (${c.suggestion})`,
        },
      }),
    };
  });

  return { candidates, observations };
}
