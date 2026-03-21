/**
 * 수렴 분석 오케스트레이터 — 5개 서비스를 한번에 실행한다.
 *
 * 입력: DKG GraphPort + UsageData (관측 집계)
 * 출력: ConvergenceReport (모든 분석 결과 + Observation 노드)
 *
 * @layer 기록 (Recording)
 */

import type { GraphPort } from "../shared/graph-port.js";
import type { ObservationNode } from "../dkg/dkg.types.js";
import type {
  UsageData,
  AxisOverlap,
  PrefixOverlap,
  DecisionConflict,
  CausalCandidate,
  SimplificationCandidate,
  BoundaryRecommendation,
} from "./convergence.types.js";

import { scanAxisOverlaps, comparePrefixes } from "./symbol-comparator.js";
import { scanDecisionConflicts } from "./decision-comparator.js";
import { discoverCausalityWithObservations } from "./causal-discovery.js";
import { scanAllSimplifications } from "./simplification-advisor.js";
import { recommendAll } from "./boundary-recommender.js";

// ═══════════════════════════════════════════════════════════════

export interface ConvergenceReport {
  readonly axisOverlaps: readonly AxisOverlap[];
  readonly prefixOverlaps: readonly PrefixOverlap[];
  readonly decisionConflicts: readonly DecisionConflict[];
  readonly causalCandidates: readonly CausalCandidate[];
  readonly simplifications: readonly SimplificationCandidate[];
  readonly boundaryRecommendations: readonly BoundaryRecommendation[];
  readonly observations: readonly ObservationNode[];
  readonly summary: string;
}

/**
 * 5개 수렴 서비스를 순차 실행하고 통합 리포트를 반환한다.
 *
 * @param graph - DKG 그래프
 * @param usage - 관측 집계 (없으면 구조 분석만 수행)
 * @param options.entriesMap - 축별 entries 맵 (scanAxisOverlaps에 필요)
 * @param options.date - Observation 날짜 (기본: today)
 */
export function runConvergenceAnalysis(
  graph: GraphPort,
  usage: UsageData | null,
  options?: {
    entriesMap?: ReadonlyMap<string, readonly string[]>;
    date?: string;
  },
): ConvergenceReport {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const allObservations: ObservationNode[] = [];

  // 1. SymbolComparator — 축 중복 스캔
  const axisOverlaps = options?.entriesMap
    ? scanAxisOverlaps(graph, options.entriesMap)
    : [];

  // 1b. Prefix 구조 비교 (모든 쌍)
  const prefixes = graph.getNodesByKind("prefix").map(n => n.id);
  const prefixOverlaps: PrefixOverlap[] = [];
  for (let i = 0; i < prefixes.length; i++) {
    for (let j = i + 1; j < prefixes.length; j++) {
      const overlap = comparePrefixes(graph, prefixes[i], prefixes[j]);
      if (overlap.structuralSimilarity > 0) {
        prefixOverlaps.push(overlap);
      }
    }
  }

  // 2. DecisionComparator — 결정 충돌 스캔
  const decisionConflicts = scanDecisionConflicts(graph);

  // 3. CausalDiscovery — 인과 후보 + Observation
  let causalCandidates: CausalCandidate[] = [];
  if (usage && usage.coOccurrences.length > 0) {
    const result = discoverCausalityWithObservations(graph, usage.coOccurrences, { date });
    causalCandidates = result.candidates;
    allObservations.push(...result.observations);
  }

  // 4. SimplificationAdvisor — prefix별 단순화 분석
  let simplifications: SimplificationCandidate[] = [];
  if (usage) {
    simplifications = scanAllSimplifications(
      graph, prefixes, usage.entryUsages, usage.addressUsages,
    );
  }

  // 5. BoundaryRecommender — 통합 경계 추천
  const boundaryRecommendations = recommendAll(graph, {
    simplifications,
    causalCandidates,
  });

  // 요약
  const parts: string[] = [];
  if (axisOverlaps.length > 0) parts.push(`축 중복 ${axisOverlaps.length}건`);
  if (prefixOverlaps.length > 0) parts.push(`prefix 유사 ${prefixOverlaps.length}건`);
  if (decisionConflicts.length > 0) parts.push(`결정 충돌 ${decisionConflicts.length}건`);
  if (causalCandidates.length > 0) parts.push(`인과 후보 ${causalCandidates.length}건`);
  const actionable = simplifications.filter(s => !s.suggestions.every(sg => sg.kind === "ok"));
  if (actionable.length > 0) parts.push(`단순화 대상 ${actionable.length}건`);
  if (boundaryRecommendations.length > 0) parts.push(`경계 추천 ${boundaryRecommendations.length}건`);
  const summary = parts.length > 0 ? parts.join(", ") : "수렴 이슈 없음";

  return {
    axisOverlaps,
    prefixOverlaps,
    decisionConflicts,
    causalCandidates,
    simplifications,
    boundaryRecommendations,
    observations: allObservations,
    summary,
  };
}
