/**
 * DKG Bridge — TransitionSpec → TransitionSpecNode 자동 변환.
 *
 * TransitionSpec이 SSOT. DKG 노드는 파생.
 * 축 참조를 역할별로 분리: matchAxes / inputAxes / outputAxes.
 * 이 분리가 전이 간 상태 의존성 분석의 기반.
 */

import type { TransitionSpec } from "./transition.types.js";
import type { TransitionSpecNode } from "../dkg/dkg.types.js";

/** match.coordinates에서 차원 이름 수집 */
function collectMatchAxes(spec: TransitionSpec): string[] {
  const axes = new Set<string>();
  for (const coord of spec.match.coordinates) {
    for (const dim of Object.keys(coord)) axes.add(dim);
  }
  return [...axes].sort();
}

/** input.all에서 축 이름 수집 */
function collectInputAxes(spec: TransitionSpec): string[] {
  const axes = new Set<string>();
  for (const cond of spec.input.all) axes.add(cond.axis);
  return [...axes].sort();
}

/** output.set에서 축 이름 수집 */
function collectOutputAxes(spec: TransitionSpec): string[] {
  const axes = new Set<string>();
  for (const assign of spec.output.set) axes.add(assign.axis);
  return [...axes].sort();
}

/**
 * TransitionSpec → TransitionSpecNode 변환.
 *
 * id 형식: `TSPEC-<transition이름의 . → - 변환>`
 */
export function toTransitionSpecNode(spec: TransitionSpec): TransitionSpecNode {
  const matchAxes = collectMatchAxes(spec);
  const inputAxes = collectInputAxes(spec);
  const outputAxes = collectOutputAxes(spec);

  // slotRefs = 전체 합집합
  const all = new Set([...matchAxes, ...inputAxes, ...outputAxes]);

  return {
    kind: "transition-spec",
    id: `TSPEC-${spec.transition.replace(/\./g, "-")}`,
    transition: spec.transition,
    version: spec.version,
    matchMode: spec.match.mode,
    coordinateCount: spec.match.coordinates.length,
    effectKind: spec.effect.kind,
    slotRefs: [...all].sort(),
    matchAxes,
    inputAxes,
    outputAxes,
  };
}

/**
 * TransitionSpec 배열 → TransitionSpecNode 배열.
 */
export function toTransitionSpecNodes(specs: readonly TransitionSpec[]): TransitionSpecNode[] {
  return specs.map(toTransitionSpecNode);
}
