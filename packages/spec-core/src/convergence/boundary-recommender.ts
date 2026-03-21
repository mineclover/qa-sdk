/**
 * 경계 추천 — 새 prefix가 필요한 시점과 위치를 추천한다.
 *
 * @layer 추천 (Recommendation)
 */

import type { GraphRegistry } from "../dkg/graph-registry.js";
import type { SimplificationCandidate, BoundaryRecommendation } from "./convergence.types.js";

/**
 * SimplificationCandidate에서 split 후보가 있으면 경계를 추천한다.
 */
export function recommendFromSimplification(
  graph: GraphRegistry,
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
  graph: GraphRegistry,
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
