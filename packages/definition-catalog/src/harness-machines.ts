// @def.doc definition-harness

/**
 * 하네스 시스템 머신 선언 — 7개 시스템 개념의 상태 머신 정의.
 *
 * harness-state-model에서 추출 — 각 머신을 독립 테스트할 수 있도록 분리.
 * 기존 4개 머신(doc-lifecycle, spec-impl, convention, db-sync)은 state-model.ts에 유지.
 */

import type { StateMachineDefinition } from "./state-model.js";

// ── Address State (GateEngine 4-state) ───────────────────
export type AddressState = "active" | "inactive" | "open" | "reserved";

export const ADDRESS_STATE_MACHINE: StateMachineDefinition<AddressState> = {
  id: "address-state",
  label: "주소 상태 (GateEngine 4-state)",
  initial: "open",
  states: [
    { id: "active", label: "활성 (encode✓ decode✓)" },
    { id: "inactive", label: "비활성 (encode✗ decode✓)" },
    { id: "open", label: "개방 (encode✓ decode✗)" },
    { id: "reserved", label: "예약 (encode✗ decode✗)", terminal: true },
  ],
  transitions: [
    { from: "open", to: "active", label: "entry 정의 완료" },
    { from: "active", to: "inactive", label: "비활성화" },
    { from: "inactive", to: "active", label: "재활성화" },
    { from: "active", to: "reserved", label: "inactive ∩ open 자동 승격" },
    { from: "open", to: "reserved", label: "inactive ∩ open 자동 승격" },
    { from: "inactive", to: "reserved", label: "inactive ∩ open 자동 승격" },
  ],
};

// ── Version Lifecycle ────────────────────────────────────
export type VersionLifecycleState = "draft" | "released" | "active" | "deprecated";

export const VERSION_LIFECYCLE_MACHINE: StateMachineDefinition<VersionLifecycleState> = {
  id: "version-lifecycle",
  label: "버전 생명주기",
  initial: "draft",
  states: [
    { id: "draft", label: "초안 (entry 수정 가능)" },
    { id: "released", label: "확정 (append-only)" },
    { id: "active", label: "활성 (권장 버전)" },
    { id: "deprecated", label: "폐기 (decode-only)", terminal: true },
  ],
  transitions: [
    { from: "draft", to: "released", label: "릴리스 (마이그레이션 확정)" },
    { from: "released", to: "active", label: "활성화 (이전 active→released)" },
    { from: "active", to: "deprecated", label: "폐기 (encode 차단)" },
    { from: "released", to: "deprecated", label: "릴리스 취소 폐기" },
  ],
};

// ── Decision Flow ────────────────────────────────────────
export type FlowState = "pending" | "active" | "completed" | "abandoned" | "blocked";

export const FLOW_STATE_MACHINE: StateMachineDefinition<FlowState> = {
  id: "decision-flow",
  label: "의사결정 흐름",
  initial: "pending",
  states: [
    { id: "pending", label: "대기" },
    { id: "active", label: "진행 중" },
    { id: "completed", label: "완료", terminal: true },
    { id: "abandoned", label: "포기", terminal: true },
    { id: "blocked", label: "차단" },
  ],
  transitions: [
    { from: "pending", to: "active", label: "시작" },
    { from: "active", to: "completed", label: "완료" },
    { from: "active", to: "abandoned", label: "포기" },
    { from: "active", to: "blocked", label: "외부 차단" },
    { from: "blocked", to: "active", label: "차단 해제" },
    { from: "blocked", to: "abandoned", label: "차단 후 포기" },
  ],
};

// ── Service Status ───────────────────────────────────────
export type ServiceState = "active" | "deprecated" | "retired";

export const SERVICE_STATE_MACHINE: StateMachineDefinition<ServiceState> = {
  id: "service-status",
  label: "서비스 상태",
  initial: "active",
  states: [
    { id: "active", label: "활성" },
    { id: "deprecated", label: "폐기 예정" },
    { id: "retired", label: "종료", terminal: true },
  ],
  transitions: [
    { from: "active", to: "deprecated", label: "폐기 선언" },
    { from: "deprecated", to: "retired", label: "완전 종료" },
    { from: "deprecated", to: "active", label: "폐기 철회" },
  ],
};

// ── Event Status ─────────────────────────────────────────
export type EventState = "active" | "deprecated" | "retired";

export const EVENT_STATE_MACHINE: StateMachineDefinition<EventState> = {
  id: "event-status",
  label: "이벤트 상태",
  initial: "active",
  states: [
    { id: "active", label: "활성" },
    { id: "deprecated", label: "폐기 예정 (수집 중단 권고)" },
    { id: "retired", label: "종료 (수집 거부)", terminal: true },
  ],
  transitions: [
    { from: "active", to: "deprecated", label: "폐기 선언" },
    { from: "deprecated", to: "retired", label: "완전 종료" },
    { from: "deprecated", to: "active", label: "폐기 철회" },
  ],
};

// ── Metric Health ────────────────────────────────────────
export type MetricHealthState = "ok" | "warning" | "critical";

export const METRIC_HEALTH_MACHINE: StateMachineDefinition<MetricHealthState> = {
  id: "metric-health",
  label: "메트릭 건강도",
  initial: "ok",
  states: [
    { id: "ok", label: "정상" },
    { id: "warning", label: "경고 (임계값 접근)" },
    { id: "critical", label: "위험 (임계값 초과)" },
  ],
  transitions: [
    { from: "ok", to: "warning", label: "임계값 접근" },
    { from: "warning", to: "critical", label: "임계값 초과" },
    { from: "warning", to: "ok", label: "회복" },
    { from: "critical", to: "warning", label: "부분 회복" },
    { from: "critical", to: "ok", label: "완전 회복" },
  ],
};

// ── Policy Candidate ─────────────────────────────────────
export type PolicyState = "candidate" | "approved" | "rejected" | "modified";

export const POLICY_STATE_MACHINE: StateMachineDefinition<PolicyState> = {
  id: "policy-candidate",
  label: "정책 후보",
  initial: "candidate",
  states: [
    { id: "candidate", label: "후보 (패턴에서 감지)" },
    { id: "approved", label: "승인", terminal: true },
    { id: "rejected", label: "거부", terminal: true },
    { id: "modified", label: "수정 후 승인", terminal: true },
  ],
  transitions: [
    { from: "candidate", to: "approved", label: "승인" },
    { from: "candidate", to: "rejected", label: "거부" },
    { from: "candidate", to: "modified", label: "수정 후 승인" },
  ],
};
