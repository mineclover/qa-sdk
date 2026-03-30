/**
 * Match Adapter — MatchPattern → ScenarioStep[] 변환.
 *
 * engine의 기존 GraphMatcher를 재사용하기 위한 어댑터.
 * CoordinatePattern의 차원 값을 StepConstraint로 변환.
 */

import type { ScenarioStep, StepConstraint } from "@qa-sdk/core";
import type { MatchPattern, CoordinatePattern } from "./transition.types.js";

/**
 * CoordinatePattern → event_key 파생.
 *
 * address_context에서 매칭되므로, event_key는 좌표의 대표 값으로 구성.
 * 규칙: 차원 값을 `.`으로 연결 (정렬된 키 순서).
 */
export function deriveEventKey(coord: CoordinatePattern): string {
  const keys = Object.keys(coord).toSorted();
  return keys.map((k) => coord[k]).join(".");
}

/**
 * CoordinatePattern → StepConstraint[].
 *
 * 각 차원을 address_context 필드에 대한 eq 제약으로 변환.
 */
export function coordToConstraints(coord: CoordinatePattern): StepConstraint[] {
  return Object.entries(coord).map(([dim, value]) => ({
    field: `address_context.${dim}`,
    op: "eq" as const,
    value,
  }));
}

/**
 * MatchPattern → ScenarioStep[] 변환.
 *
 * - single → 단일 step, kind: "sequence"
 * - ordered → 순차 steps, kind: "sequence", next 연결
 * - unordered / windowed → 1차에서 ordered와 동일 처리 (향후 확장)
 */
export function transitionMatchToScenarioSteps(
  match: MatchPattern,
  transitionName: string,
): ScenarioStep[] {
  const coords = match.coordinates;

  return coords.map((coord, i) => {
    const stepId = `${transitionName}__step_${i}`;
    const isLast = i === coords.length - 1;

    const step: ScenarioStep = {
      id: stepId,
      event_key: deriveEventKey(coord),
      required: true,
      kind: "sequence",
      constraints: coordToConstraints(coord),
    };

    // ordered/single: next로 다음 step 연결
    if (!isLast && (match.mode === "ordered" || match.mode === "single")) {
      return Object.assign({}, step, { next: [`${transitionName}__step_${i + 1}`] });
    }

    return step;
  });
}
