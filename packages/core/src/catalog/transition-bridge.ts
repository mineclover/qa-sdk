/**
 * transition-bridge — 좌표 ↔ 제어 흐름 ↔ 이벤트 3층 정합성 검증.
 *
 * PathSegment.transition (좌표 레벨)
 *   ↕ transitionId 공유
 * PipeTransitionScope (제어 흐름 레벨)
 *   ↕ events 공유
 * TransitionDef (이벤트 카탈로그 레벨)
 */

import type { PathSegment } from "./catalog.types.js";
import type { PipeFlow, PipeGraph } from "../types/pipe-spec.js";
import { getChildFlows } from "../pipe/pipe-flow-utils.js";

// ── 타입 ──────────────────────────────────────────

export interface TransitionBridgeIssue {
  readonly severity: "error" | "warning";
  readonly layer: "coordinate" | "control-flow" | "event-catalog";
  readonly message: string;
}

/** 3층에서 수집된 transition 선언 */
export interface TransitionSummary {
  /** 좌표 레벨: PathSegment.transition에 선언된 eventKey 목록 */
  readonly coordinate: string[];
  /** 제어 흐름 레벨: PipeTransitionScope.transitionId 목록 */
  readonly controlFlow: string[];
}

// ── 수집 ──────────────────────────────────────────

/** PathSegment 트리에서 transition eventKey 수집 */
export function collectCoordinateTransitions(segments: readonly PathSegment[]): string[] {
  const keys: string[] = [];
  function walk(segs: readonly PathSegment[]): void {
    for (const seg of segs) {
      if (seg.transition) keys.push(seg.transition.eventKey);
      if (seg.routes) {
        for (const route of seg.routes) {
          keys.push(route.transition.eventKey);
        }
      }
      if (seg.children) walk(seg.children);
    }
  }
  walk(segments);
  return [...new Set(keys)];
}

/** PipeGraph에서 transition-scope의 transitionId 수집 */
export function collectControlFlowTransitions(graph: PipeGraph): string[] {
  const ids: string[] = [];
  for (const pipe of graph.pipes) {
    walkFlow(pipe.flow, ids);
  }
  return [...new Set(ids)];
}

function walkFlow(flow: PipeFlow, ids: string[]): void {
  if (flow.kind === "transition-scope") {
    ids.push(flow.transitionId);
  }
  for (const child of getChildFlows(flow)) {
    walkFlow(child, ids);
  }
}

// ── 요약 ──────────────────────────────────────────

/** 좌표 + 제어 흐름에서 transition 선언 수집 */
export function summarizeTransitions(
  segments: readonly PathSegment[],
  graph: PipeGraph,
): TransitionSummary {
  return {
    coordinate: collectCoordinateTransitions(segments),
    controlFlow: collectControlFlowTransitions(graph),
  };
}

// ── 검증 ──────────────────────────────────────────

/**
 * 좌표 ↔ 제어 흐름 간 transition 정합성 검증.
 *
 * - 좌표에 선언된 transition이 제어 흐름에도 있는지 (양방향)
 * - 3층 모두 일치하면 이슈 없음
 */
export function validateTransitionBridge(
  segments: readonly PathSegment[],
  graph: PipeGraph,
): TransitionBridgeIssue[] {
  const issues: TransitionBridgeIssue[] = [];
  const summary = summarizeTransitions(segments, graph);

  const coordSet = new Set(summary.coordinate);
  const flowSet = new Set(summary.controlFlow);

  // 좌표에 있지만 제어 흐름에 없음
  for (const key of summary.coordinate) {
    if (!flowSet.has(key)) {
      issues.push({
        severity: "warning",
        layer: "coordinate",
        message: `PathSegment transition "${key}" → PipeGraph에 대응하는 transition-scope 없음`,
      });
    }
  }

  // 제어 흐름에 있지만 좌표에 없음
  for (const id of summary.controlFlow) {
    if (!coordSet.has(id)) {
      issues.push({
        severity: "warning",
        layer: "control-flow",
        message: `PipeTransitionScope "${id}" → PathSegment에 대응하는 transition 없음`,
      });
    }
  }

  return issues;
}
