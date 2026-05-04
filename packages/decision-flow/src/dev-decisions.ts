// @def.boundary df-system
/**
 * 일상 개발 의사결정 플로우 (Dev Decision Flows)
 *
 * gstack sprint 파이프라인이 "프로젝트 수준"의 결정을 다룬다면,
 * 이 플로우들은 개발자가 매일 마주치는 "작업 수준"의 결정을 다룬다.
 *
 * - 테스트가 필요한가?
 * - 기획을 확장할 것인가?
 * - 기능을 안정화할 것인가?
 * - 기존에 뭐가 있는가?
 *
 * 각 플로우는 독립적으로 실행 가능하며,
 * 범용 라우터(DECISION_ROUTER)가 적절한 플로우로 안내한다.
 */

import { FlowSchemaBuilder } from "./schema.js";
import type { DecisionUnit, FlowPolicy, FlowSchema } from "./types.js";

// ─── 테스트 필요 여부 판단 ───────────────────────────────

/**
 * "이 변경에 테스트가 필요한가?"
 *
 * 변경의 성격 → 영향 범위 → 기존 커버리지 → 판정.
 * autoplan: 리팩터+국소+커버리지 충분 → 불필요 자동 판정.
 */
export const TEST_NEEDED_FLOW: FlowSchema = new FlowSchemaBuilder(
  "test-needed",
  "테스트 필요 여부 판단",
)
  .description("이 변경에 테스트가 필요한가? 필요하다면 어떤 종류?")
  .gate("change-type", "변경의 성격", "perceive", [
    { id: "new-feature", label: "신규 기능" },
    { id: "bug-fix", label: "버그 수정" },
    { id: "refactor", label: "리팩터링 (동작 불변)" },
    { id: "config", label: "설정/의존성 변경" },
    { id: "docs", label: "문서만 변경" },
  ], { weight: "core", mentalModels: ["bezos-doors"] })
  .gate("impact-scope", "영향 범위", "evaluate", [
    { id: "local", label: "국소적 (이 파일/모듈만)" },
    { id: "module", label: "모듈 경계 (import하는 곳 있음)" },
    { id: "system", label: "시스템 전체 (API/스키마/데이터 변경)" },
  ], { weight: "structural", mentalModels: ["munger-inversion"] })
  .gate("existing-coverage", "기존 테스트 커버리지", "perceive", [
    { id: "sufficient", label: "충분 (관련 테스트가 이미 커버)" },
    { id: "partial", label: "부분적 (핵심 경로만 커버)" },
    { id: "none", label: "없음 (관련 테스트 없음)" },
  ])
  .gate("verdict", "판정", "decide", [
    { id: "not-needed", label: "테스트 불필요 (기존 커버리지 충분)" },
    { id: "add-unit", label: "단위 테스트 추가" },
    { id: "add-integration", label: "통합 테스트 추가" },
    { id: "add-e2e", label: "E2E 테스트 추가" },
    { id: "strengthen", label: "기존 테스트 강화 (케이스 추가)" },
  ], { mentalModels: ["edge-paranoia"] })
  .build();

// ─── 기획 확장 여부 판단 ─────────────────────────────────

/**
 * "이 기능/모듈을 확장할 것인가?"
 *
 * 현재 완성도 → 사용자 피드백 → 기술 부채 → 판정.
 * 코어 결정: 완성도. 미완성이면 확장보다 완성이 먼저.
 */
export const SCOPE_EXPANSION_FLOW: FlowSchema = new FlowSchemaBuilder(
  "scope-expansion",
  "기획 확장 여부 판단",
)
  .description("이 기능을 확장할 것인가, 유지할 것인가, 축소할 것인가?")
  .gate("completeness", "현재 완성도", "perceive", [
    { id: "incomplete", label: "미완성 (핵심 기능 부재)" },
    { id: "basic", label: "기본 완성 (핵심만 동작)" },
    { id: "stable", label: "안정 (프로덕션 수준)" },
  ], { weight: "core", mentalModels: ["boil-the-lake"] })
  .gate("user-feedback", "사용자 피드백", "perceive", [
    { id: "high-demand", label: "요청 많음 (반복적 피드백)" },
    { id: "moderate", label: "보통 (가끔 요청)" },
    { id: "none", label: "없음 (요청 없음)" },
  ], { mentalModels: ["proxy-skepticism"] })
  .gate("tech-debt", "기술 부채 수준", "evaluate", [
    { id: "high", label: "높음 (확장하면 부채 폭증)" },
    { id: "moderate", label: "보통 (관리 가능)" },
    { id: "low", label: "낮음 (깨끗한 기반)" },
  ], { mentalModels: ["temporal-depth"] })
  .gate("verdict", "판정", "decide", [
    { id: "expand", label: "확장 — 수요 있고 기반 안정적" },
    { id: "maintain", label: "유지 — 현재 수준 유지 + 안정화" },
    { id: "reduce", label: "축소 — 핵심만 남기고 제거" },
    { id: "defer", label: "보류 — 부채 해소 후 재판단" },
  ], { mentalModels: ["bezos-doors", "jobs-subtraction"] })
  .build();

// ─── 기능 안정화 의사결정 ────────────────────────────────

/**
 * "이 기능을 안정화해야 하는가?"
 *
 * 버그 빈도 → 성능 → 코드 품질 → 판정.
 * 코어 결정: 버그 빈도. 빈도가 높으면 다른 판단 불필요.
 */
export const STABILIZATION_FLOW: FlowSchema = new FlowSchemaBuilder(
  "stabilization",
  "기능 안정화 의사결정",
)
  .description("이 기능이 안정적인가? 안정화 작업이 필요한가?")
  .gate("bug-frequency", "버그 빈도", "perceive", [
    { id: "high", label: "높음 (주 3회 이상 보고)" },
    { id: "moderate", label: "보통 (월 1-2회)" },
    { id: "low", label: "낮음 (거의 없음)" },
  ], { weight: "core", mentalModels: ["munger-inversion"] })
  .gate("performance", "성능 상태", "evaluate", [
    { id: "sla-breach", label: "SLA 초과" },
    { id: "borderline", label: "경계 (여유 없음)" },
    { id: "healthy", label: "정상 (여유 있음)" },
  ], { mentalModels: ["edge-paranoia"] })
  .gate("code-quality", "코드 품질", "evaluate", [
    { id: "debt-heavy", label: "기술 부채 높음 (변경 비용 증가)" },
    { id: "acceptable", label: "수용 가능" },
    { id: "clean", label: "깨끗함" },
  ], { mentalModels: ["temporal-depth"] })
  .gate("verdict", "판정", "decide", [
    { id: "stable", label: "안정 — 현 상태 유지" },
    { id: "needs-fix", label: "개선 필요 — 버그/성능 수정" },
    { id: "needs-refactor", label: "리팩터 필요 — 구조 개선 후 안정화" },
    { id: "redesign", label: "재설계 — 현 구조로는 안정화 불가" },
  ], { mentalModels: ["bezos-doors", "boil-the-lake"] })
  .build();

// ─── 아키텍처 결정 ───────────────────────────────────────

/**
 * "어떤 방식/패턴/기술을 선택할 것인가?"
 *
 * 대안 비교, 트레이드오프 분석, 최종 선택.
 * 코어 결정: alternatives (어떤 대안이 있는가)
 */
export const ARCHITECTURE_DECISION_FLOW: FlowSchema = new FlowSchemaBuilder(
  "architecture-decision",
  "아키텍처 결정",
)
  .description("방식/패턴/기술 선택 — 대안 비교 + 트레이드오프 분석")
  .gate("alternatives", "대안 목록", "perceive", [
    { id: "two", label: "2개 대안" },
    { id: "three-plus", label: "3개 이상 대안" },
    { id: "single", label: "사실상 1개 (다른 선택지 없음)" },
  ], { weight: "core", mentalModels: ["munger-inversion", "jobs-subtraction"] })
  .gate("tradeoff", "트레이드오프", "evaluate", [
    { id: "clear-winner", label: "명확한 우위 — 하나가 모든 면에서 나음" },
    { id: "balanced", label: "균형 — 각각 장단점" },
    { id: "constraint-driven", label: "제약 조건이 선택을 결정" },
  ], { weight: "structural", mentalModels: ["temporal-depth", "boil-the-lake"] })
  .gate("migration-cost", "전환 비용", "evaluate", [
    { id: "none", label: "전환 비용 없음 (신규)" },
    { id: "low", label: "낮음 (점진적 전환 가능)" },
    { id: "high", label: "높음 (빅뱅 전환 필요)" },
  ], { mentalModels: ["bezos-doors"] })
  .gate("verdict", "최종 선택", "decide", [
    { id: "option-a", label: "대안 A 선택" },
    { id: "option-b", label: "대안 B 선택" },
    { id: "option-c", label: "대안 C 선택" },
    { id: "defer", label: "보류 — 정보 부족" },
    { id: "spike", label: "탐색 먼저 — PoC 필요" },
  ], { mentalModels: ["speed-calibration", "narrative-coherence"] })
  .build();

// ─── 범용 의사결정 라우터 ────────────────────────────────

/**
 * "지금 무슨 종류의 결정을 해야 하는가?"
 *
 * 모든 일상 개발 의사결정의 진입점.
 * decision-type에서 분류 후, 해당 플로우로 안내.
 */
export const DECISION_ROUTER: FlowSchema = new FlowSchemaBuilder(
  "decision-router",
  "의사결정 라우터",
)
  .description("지금 무슨 종류의 결정인가? → 적절한 플로우로 안내")
  .gate("decision-type", "결정 유형", "perceive", [
    { id: "test-needed", label: "테스트가 필요한가?" },
    { id: "scope-expansion", label: "기획을 확장할 것인가?" },
    { id: "stabilization", label: "기능을 안정화할 것인가?" },
    { id: "architecture-decision", label: "방식/패턴/기술을 선택할 것인가?" },
    { id: "feature-lookup", label: "기존에 뭐가 있는가? (조회)" },
    { id: "sprint", label: "스프린트 결정 (gstack 파이프라인)" },
    { id: "coordinate-design", label: "좌표계 설계 결정" },
    { id: "custom", label: "그 외" },
  ], { weight: "core" })
  .gate("urgency", "긴급도", "evaluate", [
    { id: "blocking", label: "차단 — 지금 안 하면 진행 불가" },
    { id: "important", label: "중요 — 이번 스프린트 내" },
    { id: "can-defer", label: "보류 가능 — 다음 스프린트도 OK" },
  ], { mentalModels: ["speed-calibration", "wartime-awareness"] })
  .gate("reversibility", "가역성", "evaluate", [
    { id: "one-way", label: "비가역 — 되돌리기 어려움" },
    { id: "two-way", label: "가역 — 쉽게 되돌림 가능" },
  ], { mentalModels: ["bezos-doors"] })
  .build();

// ─── 자동 정책 ──────────────────────────────────────────

/** 일상 개발 의사결정 자동 정책 */
export const DEV_DECISION_POLICIES: readonly FlowPolicy[] = [
  // 문서만 변경 → 테스트 불필요
  {
    id: "auto-docs-no-test",
    name: "문서 변경 → 테스트 불필요",
    flowId: "test-needed",
    priority: 100,
    conditions: [
      { field: "gate.change-type.branch", op: "eq", value: "docs" },
    ],
    action: { gateId: "verdict", branchId: "not-needed", confidence: 0.95 },
    rationale: "문서만 변경하면 테스트가 필요 없다",
  },
  // 리팩터 + 국소 + 커버리지 충분 → 테스트 불필요
  {
    id: "auto-refactor-local-covered",
    name: "안전한 리팩터 → 테스트 불필요",
    flowId: "test-needed",
    priority: 90,
    conditions: [
      { field: "gate.change-type.branch", op: "eq", value: "refactor" },
      { field: "gate.impact-scope.branch", op: "eq", value: "local" },
      { field: "gate.existing-coverage.branch", op: "eq", value: "sufficient" },
    ],
    action: { gateId: "verdict", branchId: "not-needed", confidence: 0.9 },
    rationale: "동작 불변 리팩터 + 국소 영향 + 기존 커버리지 충분 = 테스트 불필요 (standard-pattern)",
  },
  // 신규 기능 + 시스템 영향 → E2E 추가
  {
    id: "auto-new-system-e2e",
    name: "신규 기능 시스템 영향 → E2E",
    flowId: "test-needed",
    priority: 85,
    conditions: [
      { field: "gate.change-type.branch", op: "eq", value: "new-feature" },
      { field: "gate.impact-scope.branch", op: "eq", value: "system" },
    ],
    action: { gateId: "verdict", branchId: "add-e2e", confidence: 0.85 },
    rationale: "신규 기능 + 시스템 전체 영향 = E2E 테스트 필수",
  },
  // 버그 빈도 높음 → 개선 필요
  {
    id: "auto-high-bugs-fix",
    name: "버그 빈도 높음 → 개선 필요",
    flowId: "stabilization",
    priority: 95,
    conditions: [
      { field: "gate.bug-frequency.branch", op: "eq", value: "high" },
    ],
    action: { gateId: "verdict", branchId: "needs-fix", confidence: 0.9 },
    rationale: "주 3회 이상 버그 보고 = 안정화 작업 필요",
  },
  // 미완성 + 수요 없음 → 보류
  {
    id: "auto-incomplete-no-demand",
    name: "미완성 + 수요 없음 → 보류",
    flowId: "scope-expansion",
    priority: 85,
    conditions: [
      { field: "gate.completeness.branch", op: "eq", value: "incomplete" },
      { field: "gate.user-feedback.branch", op: "eq", value: "none" },
    ],
    action: { gateId: "verdict", branchId: "defer", confidence: 0.85 },
    rationale: "미완성인데 수요도 없으면 보류 — 다른 곳에 자원 투입",
  },
  // 가역 + 보류 가능 → two-way door 빠른 결정
  {
    id: "auto-two-way-defer",
    name: "가역 + 보류 가능 → 빠르게 결정",
    flowId: "decision-router",
    priority: 70,
    conditions: [
      { field: "gate.reversibility.branch", op: "eq", value: "two-way" },
      { field: "gate.urgency.branch", op: "eq", value: "can-defer" },
    ],
    action: { gateId: "reversibility", branchId: "two-way", confidence: 0.8 },
    rationale: "two-way door + 보류 가능 = 70% 정보로 빠르게 결정 (speed-calibration)",
  },
];

// ─── 전체 목록 ──────────────────────────────────────────

/** 일상 개발 의사결정 FlowSchema 목록 */
export const ALL_DEV_DECISION_FLOWS: readonly FlowSchema[] = [
  TEST_NEEDED_FLOW,
  SCOPE_EXPANSION_FLOW,
  STABILIZATION_FLOW,
  ARCHITECTURE_DECISION_FLOW,
  DECISION_ROUTER,
];

/** FlowSchema ID → FlowSchema 매핑 */
export const DEV_DECISION_REGISTRY: ReadonlyMap<string, FlowSchema> = new Map(
  ALL_DEV_DECISION_FLOWS.map((f) => [f.id, f]),
);

// ─── 의사결정 단위 (Decision Units) ─────────────────────

/**
 * 각 FlowSchema의 의사결정 단위.
 *
 * 모든 결정은 주제(topic), 목적(objective), 성공 기준(successCriteria)이 명확해야 한다.
 * 이 단위가 결정의 성공 여부를 판단하는 기준이 된다.
 */
export const DEV_DECISION_UNITS: Readonly<Record<string, DecisionUnit>> = {
  "test-needed": {
    topic: "이 변경에 테스트가 필요한가",
    objective: "불필요한 테스트 작성을 방지하고, 필요한 테스트는 빠짐없이 추가한다",
    successCriteria: [
      "변경의 성격(신규/수정/리팩터)이 정확히 분류됨",
      "영향 범위가 올바르게 판단됨",
      "판정 결과(불필요/단위/통합/E2E)가 실제 위험에 비례함",
      "판정 후 1주일 내 관련 버그가 발생하지 않음",
    ],
    fallback: "판단 불가 시 → 통합 테스트 추가 (안전한 기본값)",
  },
  "scope-expansion": {
    topic: "이 기능/모듈을 확장할 것인가",
    objective: "수요 있고 기반 안정적인 곳에 자원을 집중하고, 그렇지 않은 곳은 보류한다",
    successCriteria: [
      "현재 완성도가 정확히 평가됨",
      "사용자 피드백이 실증거 기반으로 반영됨",
      "기술 부채가 확장 전 해소되었거나 관리 가능한 수준",
      "확장 결정 후 실제 사용량이 증가하거나, 보류 결정 후 자원이 다른 곳에 효과적으로 투입됨",
    ],
    fallback: "판단 불가 시 → 유지 (현 상태 보존, 추가 정보 수집)",
  },
  "stabilization": {
    topic: "이 기능을 안정화해야 하는가",
    objective: "버그/성능/코드품질 기반으로 안정화 필요성을 판단하고, 필요 시 적절한 수준의 조치를 결정한다",
    successCriteria: [
      "버그 빈도가 정확히 측정됨",
      "성능이 SLA 대비 정확히 평가됨",
      "판정 결과(안정/개선/리팩터/재설계)가 실제 상태에 비례함",
      "조치 후 버그 빈도가 감소하거나, 안정 판정 후 1개월 내 인시던트 없음",
    ],
    fallback: "판단 불가 시 → 개선 필요 (안전한 방향)",
  },
  "architecture-decision": {
    topic: "어떤 방식/패턴/기술을 선택할 것인가",
    objective: "대안을 비교하고 트레이드오프를 분석하여 근거 있는 기술 선택을 한다",
    successCriteria: [
      "2개 이상 대안이 식별됨",
      "각 대안의 트레이드오프가 명시적으로 비교됨",
      "전환 비용이 올바르게 평가됨",
      "선택 후 6개월 내 재선택(재설계) 없음",
    ],
    fallback: "판단 불가 시 → spike (PoC 먼저 진행)",
  },
  "decision-router": {
    topic: "지금 무슨 종류의 결정을 해야 하는가",
    objective: "결정의 유형을 빠르게 분류하여 적절한 하위 플로우로 안내한다",
    successCriteria: [
      "결정 유형이 3분 내 분류됨",
      "분류된 유형이 실제 필요한 플로우와 일치함",
      "긴급도와 가역성이 올바르게 판단됨",
    ],
    fallback: "분류 불가 시 → custom (범용 결정 절차)",
  },
};
