// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * PipeFlow 순회 유틸 — 타입만 의존, 다른 pipe 모듈 의존 없음.
 * catalog 레이어에서도 순환 없이 import 가능.
 */

import type { PipeFlow } from "../types/pipe-spec.js";

/** PipeFlow의 직접 자식 흐름 반환 */
export function getChildFlows(flow: PipeFlow): PipeFlow[] {
  switch (flow.kind) {
    case "step": case "emit": return [];
    case "sequence": case "parallel": case "race": return flow.steps;
    case "branch": return flow.paths;
    case "optional": case "retry": case "throttle": case "debounce":
    case "circuit-breaker": case "filter": case "dedup":
    case "resequence": return [flow.step];
    case "loop": case "buffer": case "window": case "feedback": return [flow.body];
    case "map": case "split": return [flow.itemFlow];
    case "reduce": case "enrich": return [flow.step];
    case "fallback": return [flow.try, flow.catch];
    case "compensate": return [flow.forward, flow.compensate];
    case "transition-scope": return flow.compensate ? [flow.body, flow.compensate] : [flow.body];
    case "finally": return [flow.body, flow.cleanup];
    case "await": return [flow.then];
    case "timeout": return flow.onTimeout ? [flow.body, flow.onTimeout] : [flow.body];
    case "tap": return [flow.observe, flow.step];
    case "correlation": return flow.onTimeout ? [flow.onMatch, flow.onTimeout] : [flow.onMatch];
    default: return [];
  }
}
