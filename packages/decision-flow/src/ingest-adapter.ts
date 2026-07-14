// @def.boundary df-interface-group
/**
 * Ingest 연동 어댑터
 *
 * decision-flow의 관찰 이벤트를 qa-sdk ingest 파이프라인으로 전달하는 경로.
 *
 * 기존 파이프라인과의 통합 방식:
 * - EventRecord.address_context에 decision prefix 주소를 추가
 * - 형식: { decision_event: "decision_event:v1:1234", model_apply: "model_apply:v1:7" }
 * - ingest-server가 Phase 1에서 자동 처리 (prefix 무관 범용 파이프라인)
 * - convergence pipeline이 usage 집계 시 decision prefix도 포함
 *
 * ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
 * │ FlowEngine   │───▶│ DecisionEmitter  │───▶│ address_ctx  │
 * │ selectBranch  │    │ (이 파일)         │    │ { prefix: v  }│
 * └──────────────┘    └──────────────────┘    └──────┬───────┘
 *                                                     │
 *                                              ┌──────▼───────┐
 *                                              │ EventRecord   │
 *                                              │ .address_ctx  │
 *                                              └──────┬───────┘
 *                                                     │
 *                                              ┌──────▼───────┐
 *                                              │ ingest-server │
 *                                              │ Phase 1 → 2  │
 *                                              └──────────────┘
 */

import type { FlowInstance, GateSelection, FlowSchema } from './types.js';
import {
  encodeDecisionEvent,
  encodeDecisionPath,
  encodeEscalation,
  encodeModelApplication,
  encodeForcingResponse,
  serializeObservedEvent,
} from './observe.js';
import type { AutoDecisionPrinciple } from './mental-model.js';
import { FLOW_TYPE } from './vocabulary.js';

// ─── AddressContext 빌더 ─────────────────────────────────

/**
 * qa-sdk의 EventRecord.address_context 형식.
 * key=prefix_id, value="prefix:version:address" (SemanticAddress)
 */
export type AddressContext = Record<string, string>;

const KNOWN_FLOW_TYPE_BY_SCHEMA_ID: Record<string, string> = {
  'office-hours': 'office_hours',
  'ceo-review': 'ceo_review',
  'eng-review': 'eng_review',
  'design-review': 'design_review',
  'code-review': 'code_review',
  investigation: 'investigation',
  ship: 'ship',
};

function resolveObservedFlowType(flowId: string): string {
  const mapped = KNOWN_FLOW_TYPE_BY_SCHEMA_ID[flowId] ?? flowId.replace(/-/g, '_');
  return FLOW_TYPE.entries.includes(mapped as (typeof FLOW_TYPE.entries)[number])
    ? mapped
    : 'custom';
}

/**
 * 분기 선택 이벤트를 address_context로 변환한다.
 *
 * @example
 * ```ts
 * const ctx = buildSelectionContext("ceo_review", "evaluate", selection);
 * // → { decision_event: "decision_event:v1:1234" }
 * // EventRecord에 머지하여 ingest로 전송
 * ```
 */
export function buildSelectionContext(
  flowType: string,
  phase: string,
  selection: GateSelection,
): AddressContext {
  const event = encodeDecisionEvent(flowType, phase, selection);
  return { [event.prefix]: serializeObservedEvent(event) };
}

/**
 * 플로우 완료 이벤트를 address_context로 변환한다.
 */
export function buildPathContext(
  flowType: string,
  instance: FlowInstance,
  scopeMode?: string,
): AddressContext {
  const event = encodeDecisionPath(flowType, instance, scopeMode);
  return { [event.prefix]: serializeObservedEvent(event) };
}

/**
 * 에스컬레이션 이벤트를 address_context로 변환한다.
 */
export function buildEscalationContext(
  flowType: string,
  principle: AutoDecisionPrinciple,
  phase: string,
): AddressContext {
  const event = encodeEscalation(flowType, principle, phase);
  return { [event.prefix]: serializeObservedEvent(event) };
}

/**
 * 인지 모델 적용 이벤트를 address_context로 변환한다.
 */
export function buildModelContext(
  modelId: string,
  reversibility: string,
  magnitude: string,
): AddressContext {
  const event = encodeModelApplication(modelId, reversibility, magnitude);
  return { [event.prefix]: serializeObservedEvent(event) };
}

/**
 * Forcing Question 응답 이벤트를 address_context로 변환한다.
 */
export function buildForcingContext(
  questionId: string,
  evidenceKind: string,
  confidence: number,
): AddressContext {
  const event = encodeForcingResponse(questionId, evidenceKind, confidence);
  return { [event.prefix]: serializeObservedEvent(event) };
}

// ─── 복합 컨텍스트 빌더 ──────────────────────────────────

/**
 * 여러 관찰 이벤트를 하나의 address_context로 병합한다.
 *
 * @example
 * ```ts
 * const ctx = mergeContexts(
 *   buildSelectionContext("ceo_review", "decide", selection),
 *   buildModelContext("bezos_doors", "one_way", "critical"),
 * );
 * // → { decision_event: "decision_event:v1:42", model_apply: "model_apply:v1:7" }
 * ```
 */
export function mergeContexts(...contexts: AddressContext[]): AddressContext {
  const merged: AddressContext = {};
  for (const ctx of contexts) {
    Object.assign(merged, ctx);
  }
  return merged;
}

/**
 * 플로우 인스턴스 완료 시 전체 address_context를 생성한다.
 *
 * 포함하는 것:
 * - decision_path (완료 경로)
 * - 마지막 decision_event (최종 선택)
 *
 * @returns EventRecord.address_context에 바로 할당 가능한 객체
 */
export function buildFlowCompletionContext(
  schema: FlowSchema,
  instance: FlowInstance,
  scopeMode?: string,
): AddressContext {
  const contexts: AddressContext[] = [];
  const flowType = resolveObservedFlowType(schema.id);

  // 경로 요약
  contexts.push(buildPathContext(flowType, instance, scopeMode));

  // 마지막 선택 이벤트
  if (instance.selections.length > 0) {
    const lastSel = instance.selections[instance.selections.length - 1];
    const gate = schema.gates.find((g) => g.id === lastSel.gateId);
    if (gate) {
      contexts.push(buildSelectionContext(flowType, gate.phase, lastSel));
    }
  }

  return mergeContexts(...contexts);
}
