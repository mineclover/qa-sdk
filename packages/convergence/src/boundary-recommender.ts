/**
 * 경계 추천 — 새 prefix가 필요한 시점과 위치를 추천한다.
 *
 * @layer 추천 (Recommendation)
 */

import type { GraphPort } from "spec-schema";
import type { SimplificationCandidate, BoundaryRecommendation, CausalCandidate } from "./convergence.types.js";

/**
 * SimplificationCandidate에서 split 후보가 있으면 경계를 추천한다.
 */
export function recommendFromSimplification(
  graph: GraphPort,
  candidate: SimplificationCandidate,
): BoundaryRecommendation | null {
  const splitSuggestion = candidate.suggestions.find(s => s.kind === "split-prefix");
  if (!splitSuggestion) return null;

  // prefix가 속한 domain 찾기
  const domainEdges = graph.edgesTo(candidate.prefix, "contains");
  const suggestedDomain = domainEdges.length > 0 ? domainEdges[0].from : null;

  // 현재 prefix의 축 목록
  const axes = graph.edgesFrom(candidate.prefix, "composes")
    .filter(e => e.meta?.dimKind === "axis")
    .map(e => e.to);

  return {
    reason: `'${candidate.prefix}'의 차원 수가 과도함. 분할 권장.`,
    suggestedDomain,
    suggestedDims: axes.slice(Math.ceil(axes.length / 2)), // 후반부 축으로 분리 제안
    relatedPrefixes: [{ id: candidate.prefix, relation: "splits-from" }],
    estimatedCapacity: 16, // 기본 추정
    confidence: "medium",
  };
}

/**
 * 관측에서 기존 prefix에 매핑되지 않는 패턴을 발견하면 새 경계를 추천한다.
 */
export function recommendFromObservation(
  graph: GraphPort,
  unmappedAxes: readonly string[],
  relatedPrefix?: string,
): BoundaryRecommendation | null {
  if (unmappedAxes.length === 0) return null;

  let suggestedDomain: string | null = null;
  const relatedPrefixes: Array<{ id: string; relation: "extends" | "splits-from" | "independent" }> = [];

  if (relatedPrefix) {
    const domainEdges = graph.edgesTo(relatedPrefix, "contains");
    suggestedDomain = domainEdges.length > 0 ? domainEdges[0].from : null;
    relatedPrefixes.push({ id: relatedPrefix, relation: "extends" });
  }

  return {
    reason: `기존 prefix에 매핑되지 않는 축 [${unmappedAxes.join(", ")}] 발견.`,
    suggestedDomain,
    suggestedDims: unmappedAxes,
    relatedPrefixes,
    estimatedCapacity: unmappedAxes.length * 8, // 축당 8 기본 추정
    confidence: relatedPrefix ? "medium" : "low",
  };
}

/**
 * 인과 후보에서 교차 도메인 패턴을 발견하면 브릿지 prefix를 추천한다.
 */
export function recommendFromCausality(
  graph: GraphPort,
  candidates: readonly CausalCandidate[],
): BoundaryRecommendation[] {
  const results: BoundaryRecommendation[] = [];

  for (const c of candidates) {
    if (c.confidence !== "high") continue;
    if (c.source.prefix === c.target.prefix) continue;

    // source/target이 서로 다른 domain에 속하는지 확인
    const srcDomains = graph.edgesTo(c.source.prefix, "contains").map(e => e.from);
    const tgtDomains = graph.edgesTo(c.target.prefix, "contains").map(e => e.from);
    const crossDomain = srcDomains.length > 0 && tgtDomains.length > 0
      && !srcDomains.some(d => tgtDomains.includes(d));

    if (!crossDomain) continue;

    results.push({
      reason: `${c.source.prefix}→${c.target.prefix} 교차 도메인 인과 (rate ${(c.coOccurrenceRate * 100).toFixed(0)}%). 브릿지 prefix 검토.`,
      suggestedDomain: null,
      suggestedDims: [c.source.prefix, c.target.prefix],
      relatedPrefixes: [
        { id: c.source.prefix, relation: "extends" },
        { id: c.target.prefix, relation: "extends" },
      ],
      estimatedCapacity: 16,
      confidence: "medium",
    });
  }

  return results;
}

/**
 * 모든 추천 소스를 통합하여 중복 제거된 경계 추천 목록을 반환한다.
 */
export function recommendAll(
  graph: GraphPort,
  inputs: {
    simplifications?: readonly SimplificationCandidate[];
    causalCandidates?: readonly CausalCandidate[];
    unmappedAxes?: readonly string[];
    relatedPrefix?: string;
  },
): BoundaryRecommendation[] {
  const results: BoundaryRecommendation[] = [];

  // 1. SimplificationAdvisor → split 추천
  for (const s of inputs.simplifications ?? []) {
    const rec = recommendFromSimplification(graph, s);
    if (rec) results.push(rec);
  }

  // 2. CausalDiscovery → extends 추천
  results.push(...recommendFromCausality(graph, inputs.causalCandidates ?? []));

  // 3. 관측 미매핑 → independent 추천
  const obsRec = recommendFromObservation(graph, inputs.unmappedAxes ?? [], inputs.relatedPrefix);
  if (obsRec) results.push(obsRec);

  // 중복 제거: 같은 relatedPrefixes 조합이면 첫 번째만
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.relatedPrefixes.map(p => `${p.id}:${p.relation}`).toSorted().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
