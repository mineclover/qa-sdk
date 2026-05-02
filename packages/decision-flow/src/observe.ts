/**
 * 관찰 레이어 (Observability)
 *
 * FlowEngine의 이벤트를 좌표로 인코딩하여 관찰 가능하게 만든다.
 * 인코딩된 좌표는 기존 ingest pipeline으로 흘려보낼 수 있다.
 *
 * ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 * │  FlowEngine  │───▶│   Observer   │───▶│  좌표 인코딩   │
 * │ (분기 선택)   │    │ (이벤트 변환) │    │  (1D 정수)    │
 * └──────────────┘    └──────────────┘    └──────────────┘
 *                                                │
 *                                         ┌──────▼──────┐
 *                                         │ ingest/수집   │
 *                                         │ convergence  │
 *                                         │ 패턴 분석     │
 *                                         └─────────────┘
 */

import { WeightedIndex } from "weighted-index";
import type { FlowInstance, GateSelection } from "./types.js";
import type { AutoDecisionPrinciple } from "./mental-model.js";
import {
  COGNITIVE_PHASE,
  CONFIDENCE_BAND,
  DECISION_OUTCOME,
  ESCALATION_TYPE,
  EVIDENCE_KIND,
  FLOW_TYPE,
  FORCING_QUESTION_AXIS,
  MAGNITUDE,
  MENTAL_MODEL_AXIS,
  REVERSIBILITY,
  SCOPE_MODE,
  discretizeConfidence,
} from "./vocabulary.js";

// ─── 좌표 인덱스 (lazy init) ─────────────────────────────

let _decisionEventIdx: WeightedIndex | undefined;
let _decisionPathIdx: WeightedIndex | undefined;
let _escalationIdx: WeightedIndex | undefined;
let _modelApplyIdx: WeightedIndex | undefined;
let _forcingIdx: WeightedIndex | undefined;

function decisionEventIndex(): WeightedIndex {
  return (_decisionEventIdx ??= new WeightedIndex(
    [FLOW_TYPE.capacity, COGNITIVE_PHASE.capacity, EVIDENCE_KIND.capacity, CONFIDENCE_BAND.capacity],
    ["flow_type", "cognitive_phase", "evidence_kind", "confidence_band"],
  ));
}

function decisionPathIndex(): WeightedIndex {
  return (_decisionPathIdx ??= new WeightedIndex(
    [FLOW_TYPE.capacity, DECISION_OUTCOME.capacity, SCOPE_MODE.capacity],
    ["flow_type", "decision_outcome", "scope_mode"],
  ));
}

function escalationIndex(): WeightedIndex {
  return (_escalationIdx ??= new WeightedIndex(
    [FLOW_TYPE.capacity, ESCALATION_TYPE.capacity, COGNITIVE_PHASE.capacity],
    ["flow_type", "escalation_type", "cognitive_phase"],
  ));
}

function modelApplyIndex(): WeightedIndex {
  return (_modelApplyIdx ??= new WeightedIndex(
    [MENTAL_MODEL_AXIS.capacity, REVERSIBILITY.capacity, MAGNITUDE.capacity],
    ["mental_model", "reversibility", "magnitude"],
  ));
}

function forcingIndex(): WeightedIndex {
  return (_forcingIdx ??= new WeightedIndex(
    [FORCING_QUESTION_AXIS.capacity, EVIDENCE_KIND.capacity, CONFIDENCE_BAND.capacity],
    ["forcing_question", "evidence_kind", "confidence_band"],
  ));
}

// ─── 인코딩 유틸 ─────────────────────────────────────────

/** entries 배열에서 1-based 인덱스 조회 */
function indexOf(entries: readonly string[], value: string): number {
  const idx = entries.indexOf(value);
  if (idx === -1) throw new Error(`"${value}" not found in entries`);
  return idx + 1; // WeightedIndex는 1-based
}

// ─── 관찰 이벤트 타입 ────────────────────────────────────

/** 인코딩된 관찰 이벤트 */
export interface ObservedEvent {
  /** prefix ID (decision_event, decision_path 등) */
  readonly prefix: string;
  /** 인코딩된 1D 주소 */
  readonly address: number;
  /** ISO-8601 타임스탬프 */
  readonly timestamp: string;
  /** 원본 데이터 (디버깅용) */
  readonly raw: Record<string, string>;
}

// ─── 이벤트 인코딩 함수 ──────────────────────────────────

/**
 * 분기 선택 이벤트를 좌표로 인코딩한다.
 *
 * prefix: decision_event
 * dims: flow_type × cognitive_phase × evidence_kind × confidence_band
 */
export function encodeDecisionEvent(
  flowType: string,
  phase: string,
  selection: GateSelection,
): ObservedEvent {
  const primaryEvidence = selection.evidence[0]?.kind ?? "intuition";
  const band = discretizeConfidence(selection.confidence);

  const raw = {
    flow_type: flowType,
    cognitive_phase: phase,
    evidence_kind: primaryEvidence,
    confidence_band: band,
  };

  const address = decisionEventIndex().encode([
    indexOf(FLOW_TYPE.entries, flowType),
    indexOf(COGNITIVE_PHASE.entries, phase),
    indexOf(EVIDENCE_KIND.entries, primaryEvidence),
    indexOf(CONFIDENCE_BAND.entries, band),
  ]);

  return { prefix: "decision_event", address, timestamp: selection.timestamp || new Date().toISOString(), raw };
}

/**
 * 플로우 완료 이벤트를 좌표로 인코딩한다.
 *
 * prefix: decision_path
 * dims: flow_type × decision_outcome × scope_mode
 */
export function encodeDecisionPath(
  flowType: string,
  instance: FlowInstance,
  scopeMode: string = "hold",
): ObservedEvent {
  const outcome = instance.status === "completed"
    ? "completed"
    : instance.status === "abandoned"
    ? "abandoned"
    : "blocked";

  const raw = {
    flow_type: flowType,
    decision_outcome: outcome,
    scope_mode: scopeMode,
  };

  const address = decisionPathIndex().encode([
    indexOf(FLOW_TYPE.entries, flowType),
    indexOf(DECISION_OUTCOME.entries, outcome),
    indexOf(SCOPE_MODE.entries, scopeMode),
  ]);

  return { prefix: "decision_path", address, timestamp: instance.completedAt || new Date().toISOString(), raw };
}

/**
 * 에스컬레이션 이벤트를 좌표로 인코딩한다.
 *
 * prefix: escalation_event
 * dims: flow_type × escalation_type × cognitive_phase
 */
export function encodeEscalation(
  flowType: string,
  principle: AutoDecisionPrinciple,
  phase: string,
): ObservedEvent {
  const raw = {
    flow_type: flowType,
    escalation_type: principle,
    cognitive_phase: phase,
  };

  const address = escalationIndex().encode([
    indexOf(FLOW_TYPE.entries, flowType),
    indexOf(ESCALATION_TYPE.entries, principle),
    indexOf(COGNITIVE_PHASE.entries, phase),
  ]);

  return { prefix: "escalation_event", address, timestamp: new Date().toISOString(), raw };
}

/**
 * 인지 모델 적용 이벤트를 좌표로 인코딩한다.
 *
 * prefix: model_apply
 * dims: mental_model × reversibility × magnitude
 */
export function encodeModelApplication(
  modelId: string,
  reversibility: string,
  magnitude: string,
): ObservedEvent {
  const raw = {
    mental_model: modelId,
    reversibility,
    magnitude,
  };

  const address = modelApplyIndex().encode([
    indexOf(MENTAL_MODEL_AXIS.entries, modelId),
    indexOf(REVERSIBILITY.entries, reversibility),
    indexOf(MAGNITUDE.entries, magnitude),
  ]);

  return { prefix: "model_apply", address, timestamp: new Date().toISOString(), raw };
}

/**
 * Forcing Question 응답 이벤트를 좌표로 인코딩한다.
 *
 * prefix: forcing_response
 * dims: forcing_question × evidence_kind × confidence_band
 */
export function encodeForcingResponse(
  questionId: string,
  evidenceKind: string,
  confidence: number,
): ObservedEvent {
  const band = discretizeConfidence(confidence);

  const raw = {
    forcing_question: questionId,
    evidence_kind: evidenceKind,
    confidence_band: band,
  };

  const address = forcingIndex().encode([
    indexOf(FORCING_QUESTION_AXIS.entries, questionId),
    indexOf(EVIDENCE_KIND.entries, evidenceKind),
    indexOf(CONFIDENCE_BAND.entries, band),
  ]);

  return { prefix: "forcing_response", address, timestamp: new Date().toISOString(), raw };
}

// ─── 디코딩 ──────────────────────────────────────────────

/** prefix별 디코딩 */
export function decodeObservedEvent(prefix: string, address: number): Record<string, string> {
  switch (prefix) {
    case "decision_event": {
      const coords = decisionEventIndex().decode(address);
      return {
        flow_type: FLOW_TYPE.entries[coords[0] - 1],
        cognitive_phase: COGNITIVE_PHASE.entries[coords[1] - 1],
        evidence_kind: EVIDENCE_KIND.entries[coords[2] - 1],
        confidence_band: CONFIDENCE_BAND.entries[coords[3] - 1],
      };
    }
    case "decision_path": {
      const coords = decisionPathIndex().decode(address);
      return {
        flow_type: FLOW_TYPE.entries[coords[0] - 1],
        decision_outcome: DECISION_OUTCOME.entries[coords[1] - 1],
        scope_mode: SCOPE_MODE.entries[coords[2] - 1],
      };
    }
    case "escalation_event": {
      const coords = escalationIndex().decode(address);
      return {
        flow_type: FLOW_TYPE.entries[coords[0] - 1],
        escalation_type: ESCALATION_TYPE.entries[coords[1] - 1],
        cognitive_phase: COGNITIVE_PHASE.entries[coords[2] - 1],
      };
    }
    case "model_apply": {
      const coords = modelApplyIndex().decode(address);
      return {
        mental_model: MENTAL_MODEL_AXIS.entries[coords[0] - 1],
        reversibility: REVERSIBILITY.entries[coords[1] - 1],
        magnitude: MAGNITUDE.entries[coords[2] - 1],
      };
    }
    case "forcing_response": {
      const coords = forcingIndex().decode(address);
      return {
        forcing_question: FORCING_QUESTION_AXIS.entries[coords[0] - 1],
        evidence_kind: EVIDENCE_KIND.entries[coords[1] - 1],
        confidence_band: CONFIDENCE_BAND.entries[coords[2] - 1],
      };
    }
    default:
      throw new Error(`알 수 없는 prefix: "${prefix}"`);
  }
}

// ─── 직렬화 ──────────────────────────────────────────────

/**
 * 관찰 이벤트를 SemanticAddress 형식 문자열로 직렬화한다.
 *
 * 형식: "decision_event:v1:42"
 * 기존 qa-sdk의 "permission:v4:1376"과 동일 패턴.
 */
export function serializeObservedEvent(event: ObservedEvent): string {
  return `${event.prefix}:v1:${event.address}`;
}

/** SemanticAddress 형식 문자열을 파싱하여 디코딩한다 */
export function parseAndDecodeAddress(serialized: string): {
  prefix: string;
  version: string;
  address: number;
  decoded: Record<string, string>;
} {
  const parts = serialized.split(":");
  if (parts.length !== 3) throw new Error(`잘못된 형식: "${serialized}" (expected "prefix:version:address")`);

  const [prefix, version, addrStr] = parts;
  const address = parseInt(addrStr, 10);
  const decoded = decodeObservedEvent(prefix, address);

  return { prefix, version, address, decoded };
}
