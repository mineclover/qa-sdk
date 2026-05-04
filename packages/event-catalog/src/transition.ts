// @def.boundary event-vocab-system
/**
 * transition — 선언적 비즈니스 트랜잭션 레지스트리 + 검증.
 *
 * TransitionDef는 이벤트들의 원자 경계 그룹을 선언한다.
 * PipeTransitionScope.transitionId와 동일한 ID를 공유하여
 * 제어 흐름(pipe) ↔ 이벤트 카탈로그 간 정합성을 검증한다.
 */

import type { TransitionDef } from "./types.js";

// ── Registry ──────────────────────────────────────

const transitionMap = new Map<string, TransitionDef>();

export function registerTransitions(defs: TransitionDef[]): void {
  for (const def of defs) {
    transitionMap.set(def.transitionId, def);
  }
}

export function getTransition(transitionId: string): TransitionDef | undefined {
  return transitionMap.get(transitionId);
}

export function getAllTransitions(): TransitionDef[] {
  return [...transitionMap.values()];
}

export function clearTransitions(): void {
  transitionMap.clear();
}

// ── Validation ────────────────────────────────────

export interface TransitionIssue {
  readonly severity: "error" | "warning";
  readonly transitionId: string;
  readonly message: string;
}

/**
 * PipeTransitionScope의 events와 TransitionDef의 events 정합성 검증.
 *
 * @param pipeTransitionId - PipeTransitionScope.transitionId
 * @param pipeEvents - PipeTransitionScope.events
 */
export function validateTransitionEvents(
  pipeTransitionId: string,
  pipeEvents: string[],
): TransitionIssue[] {
  const issues: TransitionIssue[] = [];
  const def = transitionMap.get(pipeTransitionId);

  if (!def) {
    issues.push({
      severity: "warning",
      transitionId: pipeTransitionId,
      message: `transition "${pipeTransitionId}" 이 event-catalog에 등록되지 않음`,
    });
    return issues;
  }

  const defEventSet = new Set(def.events);
  const pipeEventSet = new Set(pipeEvents);

  // pipe에 있지만 TransitionDef에 없는 이벤트
  for (const ev of pipeEvents) {
    if (!defEventSet.has(ev)) {
      issues.push({
        severity: "warning",
        transitionId: pipeTransitionId,
        message: `PipeTransitionScope에 "${ev}" 이벤트가 있지만 TransitionDef에는 없음`,
      });
    }
  }

  // TransitionDef에 있지만 pipe에 없는 이벤트
  for (const ev of def.events) {
    if (!pipeEventSet.has(ev)) {
      issues.push({
        severity: "warning",
        transitionId: pipeTransitionId,
        message: `TransitionDef에 "${ev}" 이벤트가 있지만 PipeTransitionScope에는 없음`,
      });
    }
  }

  return issues;
}
