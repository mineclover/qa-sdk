// @def.boundary df-model-group
/**
 * 의사결정 도메인 카탈로그 — prefix 정의 + 좌표 공간 구성
 *
 * 5개 prefix가 의사결정의 관찰 가능한 이벤트를 정의한다.
 * 기존 Catalog 인터페이스를 따르며, DEMO_CATALOG에 병합하거나 독립 사용 가능.
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │                  의사결정 관찰 좌표 공간                      │
 * │                                                            │
 * │  decision_event ─── "어떤 단계에서 어떤 근거로 선택했는가"      │
 * │  decision_path ──── "전체 플로우가 어떻게 끝났는가"            │
 * │  escalation_event ─ "왜 인간에게 물어야 했는가"               │
 * │  model_apply ────── "어떤 인지 모델로 판단했는가"              │
 * │  forcing_response ─ "강제 질문에 어떻게 답했는가"              │
 * └────────────────────────────────────────────────────────────┘
 */

import {
  DECISION_AXES,
} from "./vocabulary.js";

// ─── 타입 (Catalog 인터페이스 호환) ──────────────────────

import type { VersionedAxis } from "./vocabulary.js";
export type { VersionedAxis } from "./vocabulary.js";

type DimRef =
  | { readonly kind: "axis"; readonly axisId: string }
  | { readonly kind: "prefix_ref"; readonly prefixId: string }
  | { readonly kind: "table_ref"; readonly table: string };

interface PrefixMeta {
  readonly category?: "entity" | "event" | "relation" | "state" | "policy" | "observation";
  readonly layer?: 0 | 1 | 2 | 3;
  readonly visualShape?: "cube" | "thin-bar" | "flat-tile" | "column" | "sphere";
  readonly detailKind?: "schema" | "permission" | "event-def" | "endpoint" | "flow-step" | "config" | "metric" | "generic";
}

interface PrefixVersionDef {
  readonly version: string;
  readonly axisVersions: Record<string, string>;
}

interface PrefixDef {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, DimRef>;
  readonly versions: readonly PrefixVersionDef[];
  readonly meta?: PrefixMeta;
}

interface DecisionCatalog {
  readonly id: string;
  readonly name: string;
  readonly axes: Record<string, VersionedAxis>;
  readonly prefixes: Record<string, PrefixDef>;
}

// ─── Prefix 정의 ─────────────────────────────────────────

/**
 * decision_event — 분기 선택 이벤트
 *
 * "어떤 플로우의 어떤 인지 단계에서, 어떤 근거로, 얼마나 확신하여 선택했는가"
 *
 * shape: flow_type(16) × cognitive_phase(16) × evidence_kind(8) × confidence_band(8)
 * totalSpace: 16,384
 */
const DECISION_EVENT: PrefixDef = {
  id: "decision_event",
  name: "분기 선택 이벤트",
  description: "의사결정 플로우에서 개별 gate 선택이 발생할 때 기록",
  labels: ["flow_type", "cognitive_phase", "evidence_kind", "confidence_band"],
  dims: {
    flow_type:       { kind: "axis", axisId: "flow_type" },
    cognitive_phase: { kind: "axis", axisId: "cognitive_phase" },
    evidence_kind:   { kind: "axis", axisId: "evidence_kind" },
    confidence_band: { kind: "axis", axisId: "confidence_band" },
  },
  versions: [{
    version: "v1",
    axisVersions: { flow_type: "v1", cognitive_phase: "v1", evidence_kind: "v1", confidence_band: "v1" },
  }],
  meta: { category: "event", layer: 1, visualShape: "flat-tile", detailKind: "event-def" },
};

/**
 * decision_path — 완료된 의사결정 경로
 *
 * "어떤 유형의 플로우가 어떤 스코프 모드에서 어떤 결과로 끝났는가"
 *
 * shape: flow_type(16) × decision_outcome(8) × scope_mode(8)
 * totalSpace: 1,024
 */
const DECISION_PATH: PrefixDef = {
  id: "decision_path",
  name: "의사결정 경로",
  description: "의사결정 플로우 인스턴스 완료 시 전체 경로 기록",
  labels: ["flow_type", "decision_outcome", "scope_mode"],
  dims: {
    flow_type:        { kind: "axis", axisId: "flow_type" },
    decision_outcome: { kind: "axis", axisId: "decision_outcome" },
    scope_mode:       { kind: "axis", axisId: "scope_mode" },
  },
  versions: [{
    version: "v1",
    axisVersions: { flow_type: "v1", decision_outcome: "v1", scope_mode: "v1" },
  }],
  meta: { category: "observation", layer: 1, visualShape: "cube", detailKind: "flow-step" },
};

/**
 * escalation_event — 에스컬레이션 이벤트
 *
 * "자동 판정이 왜 실패하여 어떤 인지 단계에서 인간에게 물어야 했는가"
 *
 * shape: flow_type(16) × escalation_type(8) × cognitive_phase(16)
 * totalSpace: 2,048
 */
const ESCALATION_EVENT: PrefixDef = {
  id: "escalation_event",
  name: "에스컬레이션 이벤트",
  description: "자동 판정 불가 → 인간 결정 요청 시 기록",
  labels: ["flow_type", "escalation_type", "cognitive_phase"],
  dims: {
    flow_type:       { kind: "axis", axisId: "flow_type" },
    escalation_type: { kind: "axis", axisId: "escalation_type" },
    cognitive_phase: { kind: "axis", axisId: "cognitive_phase" },
  },
  versions: [{
    version: "v1",
    axisVersions: { flow_type: "v1", escalation_type: "v1", cognitive_phase: "v1" },
  }],
  meta: { category: "event", layer: 2, visualShape: "flat-tile", detailKind: "event-def" },
};

/**
 * model_apply — 인지 모델 적용 이벤트
 *
 * "어떤 인지 모델로, 가역성과 영향을 어떻게 분류했는가"
 *
 * shape: mental_model(32) × reversibility(4) × magnitude(8)
 * totalSpace: 1,024
 */
const MODEL_APPLY: PrefixDef = {
  id: "model_apply",
  name: "인지 모델 적용",
  description: "의사결정에 인지 프레임워크를 적용할 때 기록",
  labels: ["mental_model", "reversibility", "magnitude"],
  dims: {
    mental_model:  { kind: "axis", axisId: "mental_model" },
    reversibility: { kind: "axis", axisId: "reversibility" },
    magnitude:     { kind: "axis", axisId: "magnitude" },
  },
  versions: [{
    version: "v1",
    axisVersions: { mental_model: "v1", reversibility: "v1", magnitude: "v1" },
  }],
  meta: { category: "observation", layer: 1, visualShape: "cube", detailKind: "generic" },
};

/**
 * forcing_response — Forcing Question 응답
 *
 * "어떤 강제 질문에, 어떤 근거로, 어떤 확신으로 답했는가"
 *
 * shape: forcing_question(8) × evidence_kind(8) × confidence_band(8)
 * totalSpace: 512
 */
const FORCING_RESPONSE: PrefixDef = {
  id: "forcing_response",
  name: "강제 질문 응답",
  description: "Office Hours 6 Forcing Questions에 대한 응답 기록",
  labels: ["forcing_question", "evidence_kind", "confidence_band"],
  dims: {
    forcing_question: { kind: "axis", axisId: "forcing_question" },
    evidence_kind:    { kind: "axis", axisId: "evidence_kind" },
    confidence_band:  { kind: "axis", axisId: "confidence_band" },
  },
  versions: [{
    version: "v1",
    axisVersions: { forcing_question: "v1", evidence_kind: "v1", confidence_band: "v1" },
  }],
  meta: { category: "event", layer: 1, visualShape: "flat-tile", detailKind: "event-def" },
};

// ─── 의사결정 카탈로그 ───────────────────────────────────

/**
 * DECISION_CATALOG — 의사결정 도메인 카탈로그
 *
 * 11개 축 + 5개 prefix로 의사결정의 전 과정을 관찰 가능하게 만든다.
 *
 * 총 좌표 공간:
 *   decision_event:    16,384 (개별 선택)
 *   decision_path:      1,024 (전체 경로)
 *   escalation_event:   2,048 (에스컬레이션)
 *   model_apply:        1,024 (인지 모델)
 *   forcing_response:     512 (강제 질문)
 *                     ──────
 *   합계:              20,992 좌표
 */
export const DECISION_CATALOG: DecisionCatalog = {
  id: "decision",
  name: "의사결정 관찰",
  axes: DECISION_AXES,
  prefixes: {
    decision_event:    DECISION_EVENT,
    decision_path:     DECISION_PATH,
    escalation_event:  ESCALATION_EVENT,
    model_apply:       MODEL_APPLY,
    forcing_response:  FORCING_RESPONSE,
  },
};

/** prefix ID 목록 */
export const DECISION_PREFIX_IDS = Object.keys(DECISION_CATALOG.prefixes) as readonly string[];

/** 축 ID 목록 */
export const DECISION_AXIS_IDS = Object.keys(DECISION_CATALOG.axes) as readonly string[];
