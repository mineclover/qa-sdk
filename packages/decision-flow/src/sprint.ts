// @def.boundary df-system
/**
 * 스프린트 파이프라인 — gstack(garrytan/gstack) 의사결정 흐름 모델링
 *
 * Think → Plan → Build → Review → Debug → Ship → Reflect
 * 각 단계가 FlowSchema로 정의되고, 상위 파이프라인에서 subFlow로 참조된다.
 *
 * 핵심 원칙:
 * - 각 단계의 출력이 다음 단계의 입력 (design doc → plan review → implementation)
 * - 자동 처리 가능한 것은 자동으로, taste decision만 인간에게
 * - 모든 분기점에 인지 프레임워크(mental model) 적용
 */

import { FlowSchemaBuilder } from "./schema.js";
import type { FlowPolicy, FlowSchema } from "./types.js";

// ─── Sub-flow: Forcing Questions ─────────────────────────

/**
 * 6 Forcing Questions — 각 질문이 독립 gate.
 *
 * 각 gate에서 "이 질문에 얼마나 강한 근거로 답했는가"가 좌표에 인코딩된다.
 * 6차원 × 3값 = 729 경로 → 제품 타당성의 정밀한 프로파일.
 */
export const FORCING_QUESTIONS_FLOW: FlowSchema = new FlowSchemaBuilder(
  "forcing-questions",
  "6 Forcing Questions",
)
  .description("제품/기능의 근본 타당성을 6개 강제 질문으로 검증한다")
  .gate("demand-reality", "수요 현실", "evaluate", [
    { id: "strong", label: "강한 증거 (실제 행동 데이터)" },
    { id: "moderate", label: "보통 (관심 표현, 대기자)" },
    { id: "weak", label: "약함 (가설만, 증거 없음)" },
  ], { mentalModels: ["proxy-skepticism"] })
  .gate("status-quo", "현재 상태", "perceive", [
    { id: "painful-workaround", label: "고통스러운 우회법 사용 중" },
    { id: "acceptable", label: "그럭저럭 사용 가능" },
    { id: "no-alternative", label: "대안 없음 — 문제 자체를 의심" },
  ])
  .gate("desperate-specificity", "절박한 구체성", "perceive", [
    { id: "named-person", label: "실제 사람 + 일상 관찰됨" },
    { id: "persona", label: "페르소나 수준 (추상적)" },
    { id: "unknown", label: "대상 불명확" },
  ])
  .gate("narrowest-wedge", "최소 쐐기", "plan", [
    { id: "defined", label: "이번 주 출시 가능한 최소 유료 단위 정의됨" },
    { id: "too-large", label: "최소 단위가 아직 크다 — 더 줄여야" },
    { id: "platform-trap", label: "플랫폼부터 만들려는 유혹" },
  ], { mentalModels: ["jobs-subtraction"] })
  .gate("observation", "관찰", "perceive", [
    { id: "observed", label: "실사용 관찰 완료 — 놀란 점 있음" },
    { id: "planned", label: "관찰 예정" },
    { id: "not-done", label: "아직 안 해봄 — 가장 중요한 다음 행동" },
  ])
  .gate("future-fit", "미래 적합성", "evaluate", [
    { id: "more-essential", label: "3년 뒤 더 필수적" },
    { id: "stable", label: "현재와 비슷" },
    { id: "declining", label: "트렌드 의존 — 구조적 변화에 취약" },
  ], { mentalModels: ["temporal-depth"] })
  .build();

// ─── Sub-flow: Office Hours (Think) ──────────────────────

/**
 * gstack /office-hours 의사결정 흐름.
 *
 * 제품/기능의 근본적 타당성을 검증.
 * diagnostic=full이면 forcing-questions subFlow로 진입.
 * 출력: design document.
 */
export const OFFICE_HOURS_FLOW: FlowSchema = new FlowSchemaBuilder(
  "office-hours",
  "YC Office Hours",
)
  .description("제품/기능의 근본 타당성을 검증하고 설계 문서를 생성한다")
  .gate("context", "컨텍스트 수집", "perceive", [
    { id: "existing-project", label: "기존 프로젝트 발전" },
    { id: "new-idea", label: "새 아이디어" },
    { id: "pivot", label: "방향 전환" },
  ], { mentalModels: ["three-layer"] })
  .gate("mode", "모드 선택", "decide", [
    { id: "startup", label: "스타트업 모드 (수요 검증, 진단적)" },
    { id: "builder", label: "빌더 모드 (해커톤, 학습, 재미)" },
  ])
  .subFlowGate("diagnostic", "6 Forcing Questions 진단", "evaluate", "forcing-questions")
  .gate("landscape", "환경 조사", "perceive", [
    { id: "search", label: "시장/기술 환경 조사" },
    { id: "skip-private", label: "비공개 유지 (내부 지식만)" },
  ])
  .gate("premise", "전제 도전", "evaluate", [
    { id: "validated", label: "전제 검증됨 — 진행" },
    { id: "pivoted", label: "전제 변경 — 방향 수정" },
    { id: "killed", label: "근본적 결함 — 중단" },
  ], { mentalModels: ["munger-inversion", "proxy-skepticism"] })
  .gate("approach", "접근법 선택", "decide", [
    { id: "recommended", label: "권장 접근법 채택" },
    { id: "alternative-a", label: "대안 A" },
    { id: "alternative-b", label: "대안 B" },
    { id: "custom", label: "커스텀 접근법" },
  ], { mentalModels: ["jobs-subtraction", "speed-calibration"] })
  .build();

// ─── Sub-flow: CEO Review (Plan - Strategic) ─────────────

/**
 * gstack /plan-ceo-review 의사결정 흐름.
 *
 * 전략적 스코프를 결정하는 핵심 플로우.
 * 4가지 scope mode가 이후 모든 gate의 행동을 결정한다.
 */
export const CEO_REVIEW_FLOW: FlowSchema = new FlowSchemaBuilder(
  "ceo-review",
  "CEO 전략 리뷰",
)
  .description("전략적 스코프 결정 + 10개 섹션 심층 리뷰")
  .gate("premise", "전제 도전", "evaluate", [
    { id: "right-problem", label: "올바른 문제다" },
    { id: "reframe", label: "문제 재정의 필요" },
    { id: "defer", label: "아무것도 하지 않는 게 나을 수 있다" },
  ], { mentalModels: ["munger-inversion"], weight: "core" })
  .gate("code-leverage", "기존 코드 활용", "perceive", [
    { id: "extend", label: "기존 코드 확장" },
    { id: "refactor", label: "리팩터링 후 재사용" },
    { id: "rebuild", label: "새로 구축 (정당한 사유)" },
  ], { mentalModels: ["boil-the-lake"] })
  .gate("alternatives", "구현 대안", "evaluate", [
    { id: "minimal", label: "최소 (가장 작은 diff)" },
    { id: "ideal", label: "이상적 아키텍처 (장기 최적)" },
    { id: "pragmatic", label: "실용적 절충안" },
  ], { mentalModels: ["jobs-subtraction", "temporal-depth"] })
  .gate("scope-mode", "스코프 모드", "decide", [
    { id: "expansion", label: "확장 — 10x 비전, 대성당을 짓는다" },
    { id: "selective", label: "선택적 확장 — 기본 + 체리픽" },
    { id: "hold", label: "스코프 유지 — 방탄으로 만든다" },
    { id: "reduction", label: "축소 — 외과의사처럼 자른다" },
  ], { mentalModels: ["bezos-doors", "founder-mode"], weight: "core" })
  .gate("risk", "위험 평가", "evaluate", [
    { id: "low", label: "낮음 — 예측 가능" },
    { id: "medium", label: "보통 — 관리 가능한 미지" },
    { id: "high", label: "높음 — 중대한 미지 존재" },
    { id: "critical", label: "치명적 — spike 먼저" },
  ], { mentalModels: ["speed-calibration", "wartime-awareness"] })
  .gate("timeline", "일정 판정", "plan", [
    { id: "within-sprint", label: "스프린트 내 완료" },
    { id: "multi-sprint", label: "복수 스프린트" },
    { id: "epic", label: "에픽 (단계적 출시)" },
  ], { mentalModels: ["temporal-depth"] })
  .build();

// ─── Sub-flow: Eng Review (Plan - Technical) ─────────────

/**
 * gstack /plan-eng-review 의사결정 흐름.
 *
 * 기술적 아키텍처 잠금. 다이어그램 필수.
 */
export const ENG_REVIEW_FLOW: FlowSchema = new FlowSchemaBuilder(
  "eng-review",
  "엔지니어링 리뷰",
)
  .description("아키텍처 잠금, 실패 모드 매핑, 테스트 계획")
  .gate("architecture", "아키텍처 판정", "evaluate", [
    { id: "approved", label: "아키텍처 승인" },
    { id: "needs-revision", label: "수정 필요" },
    { id: "spike-first", label: "탐색 선행 필요" },
  ], { mentalModels: ["munger-inversion"], weight: "structural" })
  .gate("failure-modes", "실패 모드 매핑", "evaluate", [
    { id: "all-mapped", label: "전체 실패 경로 매핑 완료" },
    { id: "gaps-found", label: "미매핑 실패 경로 발견 — 보완 필요" },
  ], { mentalModels: ["munger-inversion", "edge-paranoia"] })
  .gate("test-strategy", "테스트 전략", "plan", [
    { id: "unit-focus", label: "단위 테스트 중심" },
    { id: "integration-focus", label: "통합 테스트 중심" },
    { id: "e2e-focus", label: "E2E 테스트 중심" },
    { id: "mixed", label: "혼합 전략" },
  ])
  .gate("observability", "관측성 계획", "plan", [
    { id: "logs-only", label: "로그만" },
    { id: "logs-metrics", label: "로그 + 메트릭" },
    { id: "full-trace", label: "로그 + 메트릭 + 트레이스" },
  ])
  .build();

// ─── Sub-flow: Design Review (Plan - UX) ─────────────────

/**
 * gstack /plan-design-review 의사결정 흐름.
 *
 * 7개 설계 차원을 0-10으로 평가. AI Slop 감지 포함.
 */
export const DESIGN_REVIEW_FLOW: FlowSchema = new FlowSchemaBuilder(
  "design-review",
  "설계 리뷰",
)
  .description("7개 설계 차원 평가 + AI Slop 감지")
  .gate("info-arch", "정보 아키텍처", "evaluate", [
    { id: "clear", label: "명확함 (8-10)" },
    { id: "adequate", label: "적절함 (5-7)" },
    { id: "confused", label: "혼란스러움 (0-4)" },
  ], { mentalModels: ["design-trust"] })
  .gate("interaction", "인터랙션 상태", "evaluate", [
    { id: "complete", label: "모든 상태 정의됨" },
    { id: "partial", label: "주요 상태만 정의" },
    { id: "missing", label: "상태 정의 부재" },
  ], { mentalModels: ["edge-paranoia"] })
  .gate("ai-slop", "AI Slop 감지", "evaluate", [
    { id: "clean", label: "인간이 쓴 것 같다" },
    { id: "minor", label: "약간의 AI 느낌" },
    { id: "heavy", label: "뻔한 AI 생성물 — 재작성 필요" },
  ], { mentalModels: ["narrative-coherence"] })
  .gate("accessibility", "접근성", "evaluate", [
    { id: "a11y-ready", label: "WCAG 준수" },
    { id: "needs-work", label: "접근성 보완 필요" },
    { id: "not-considered", label: "고려되지 않음" },
  ], { mentalModels: ["design-trust", "jobs-subtraction"] })
  .build();

// ─── Sub-flow: Code Review (Review) ──────────────────────

/**
 * gstack /review 의사결정 흐름.
 *
 * 2-pass 코드 리뷰 + scope drift 감지.
 */
export const CODE_REVIEW_FLOW: FlowSchema = new FlowSchemaBuilder(
  "code-review",
  "코드 리뷰",
)
  .description("2-pass 리뷰 + scope drift 감지 + auto-fix")
  .gate("scope-drift", "스코프 표류 감지", "perceive", [
    { id: "on-scope", label: "스코프 내" },
    { id: "minor-drift", label: "경미한 표류 — 허용" },
    { id: "major-drift", label: "심각한 표류 — 분리 필요" },
  ])
  .gate("severity", "발견 심각도", "evaluate", [
    { id: "clean", label: "중요 이슈 없음" },
    { id: "auto-fixable", label: "자동 수정 가능한 이슈" },
    { id: "needs-discussion", label: "논의 필요한 이슈" },
    { id: "blocking", label: "머지 차단 이슈" },
  ], { mentalModels: ["munger-inversion", "edge-paranoia"] })
  .gate("action", "리뷰 조치", "decide", [
    { id: "approve", label: "승인" },
    { id: "approve-with-nits", label: "사소한 수정 후 승인" },
    { id: "request-changes", label: "변경 요청" },
    { id: "reject", label: "거부" },
  ])
  .build();

// ─── Sub-flow: Investigation (Debug) ─────────────────────

/**
 * gstack /investigate 의사결정 흐름.
 *
 * Iron Law: 원인 분석 없이 수정 금지. 3-strike rule.
 */
export const INVESTIGATION_FLOW: FlowSchema = new FlowSchemaBuilder(
  "investigation",
  "체계적 디버깅",
)
  .description("Iron Law: 원인 분석 → 가설 → 수정 → 검증. 3-strike rule")
  .gate("symptoms", "증상 수집", "perceive", [
    { id: "reproducible", label: "재현 가능" },
    { id: "intermittent", label: "간헐적" },
    { id: "reported-only", label: "보고만 있음 (재현 불가)" },
  ])
  .gate("root-cause", "원인 분석", "interpret", [
    { id: "identified", label: "원인 특정됨" },
    { id: "narrowed", label: "범위 좁혀짐 (가설 2-3개)" },
    { id: "unknown", label: "원인 불명 — 추가 조사 필요" },
  ], { mentalModels: ["munger-inversion"] })
  .gate("fix-strategy", "수정 전략", "plan", [
    { id: "direct-fix", label: "직접 수정" },
    { id: "workaround", label: "우회 + 후속 근본 수정" },
    { id: "escalate", label: "에스컬레이션 (내 범위 밖)" },
  ], { mentalModels: ["bezos-doors", "speed-calibration"] })
  .gate("verification", "검증", "reflect", [
    { id: "fixed", label: "수정 확인 + 회귀 테스트 추가" },
    { id: "partial", label: "부분 수정 — 후속 필요" },
    { id: "failed", label: "수정 실패 — 재시도 또는 접근 변경", terminal: true },
  ])
  .build();

// ─── Sub-flow: Build (구현) ──────────────────────────────

/**
 * gstack Build 단계 — 계획 기반 구현.
 *
 * 계획(Plan)의 출력을 받아 구현 전략을 결정한다.
 * boil-the-lake 원칙: AI가 한계 비용을 0에 가깝게 만들었으면 완전 구현.
 */
export const BUILD_FLOW: FlowSchema = new FlowSchemaBuilder(
  "build",
  "구현",
)
  .description("계획 기반 구현 — 구현 범위, 기술 부채, 완성도 결정")
  .gate("implementation-scope", "구현 범위", "plan", [
    { id: "full", label: "계획 전체 구현 (boil the lake)" },
    { id: "mvp", label: "MVP만 — 나머지 후속" },
    { id: "spike", label: "탐색적 구현 — 학습 목적" },
  ], { mentalModels: ["boil-the-lake", "speed-calibration"], weight: "structural" })
  .gate("tech-debt", "기술 부채 처리", "evaluate", [
    { id: "clean-as-you-go", label: "발견 즉시 정리" },
    { id: "track-and-defer", label: "기록만 하고 후속" },
    { id: "ignore", label: "무시 (타임라인 압박)" },
  ], { mentalModels: ["temporal-depth", "narrative-coherence"] })
  .gate("completeness", "완성도 판정", "reflect", [
    { id: "production-ready", label: "프로덕션 준비 완료" },
    { id: "needs-polish", label: "마무리 필요" },
    { id: "needs-iteration", label: "반복 필요 — 재진입" },
  ], { mentalModels: ["boil-the-lake", "edge-paranoia"] })
  .build();

// ─── Sub-flow: Ship (Release) ────────────────────────────

/**
 * gstack /ship 의사결정 흐름.
 *
 * 테스트 → 리뷰 → 버전 → PR → 배포.
 */
export const SHIP_FLOW: FlowSchema = new FlowSchemaBuilder("ship", "출시")
  .description("테스트 검증 → 리뷰 확인 → 버전 범프 → PR 생성")
  .gate("tests", "테스트 상태", "execute", [
    { id: "all-pass", label: "전체 통과" },
    { id: "new-tests-needed", label: "신규 테스트 필요" },
    { id: "failures", label: "실패 존재 — 수정 필요", terminal: true },
  ])
  .gate("review-status", "리뷰 상태", "evaluate", [
    { id: "reviewed", label: "리뷰 완료" },
    { id: "self-review", label: "셀프 리뷰 (소규모 변경)" },
    { id: "needs-review", label: "리뷰 필요", terminal: true },
  ])
  .gate("version-bump", "버전 결정", "decide", [
    { id: "patch", label: "패치 (버그 수정)" },
    { id: "minor", label: "마이너 (기능 추가)" },
    { id: "major", label: "메이저 (호환성 변경)" },
  ], { mentalModels: ["bezos-doors"] })
  .build();

// ─── Sub-flow: Reflect (회고) ────────────────────────────

/**
 * gstack /retro 의사결정 흐름.
 *
 * 주간 회고. 스프린트 전체를 되돌아보고 교훈을 추출한다.
 * 서사(narrative)의 회고(reflection) 단계에 해당.
 */
export const REFLECT_FLOW: FlowSchema = new FlowSchemaBuilder(
  "reflect",
  "회고",
)
  .description("스프린트 회고 — 무엇을 배웠고, 다음에 무엇을 바꿀 것인가")
  .gate("velocity", "속도 평가", "reflect", [
    { id: "on-track", label: "계획대로 진행" },
    { id: "faster", label: "예상보다 빠름 — 다음에 더 도전" },
    { id: "slower", label: "예상보다 느림 — 원인 분석 필요" },
  ], { mentalModels: ["speed-calibration"] })
  .gate("quality", "품질 평가", "reflect", [
    { id: "high", label: "높은 품질 유지" },
    { id: "debt-accumulated", label: "기술 부채 누적 — 다음 스프린트 해소" },
    { id: "incidents", label: "인시던트 발생 — 사후 분석 필요" },
  ], { mentalModels: ["munger-inversion", "temporal-depth"] })
  .gate("learning", "교훈 추출", "reflect", [
    { id: "pattern-found", label: "반복 패턴 발견 — 자동화 후보" },
    { id: "surprise", label: "예상 밖 발견 — 축/정책 수정 검토" },
    { id: "no-change", label: "특별한 교훈 없음 — 유지" },
  ], { mentalModels: ["three-layer", "narrative-coherence"] })
  .build();

// ─── Top-level: Sprint Pipeline ──────────────────────────

/**
 * 스프린트 파이프라인 — 전체 의사결정 흐름의 최상위 구조.
 *
 * gstack의 Think → Plan → Build → Review → Debug → Ship → Reflect를
 * FlowSchema 합성으로 표현한다.
 *
 * 각 단계는 subFlow로 참조. 전체 경로가 하나의 좌표로 인코딩된다.
 */
export const SPRINT_PIPELINE: FlowSchema = new FlowSchemaBuilder(
  "sprint-pipeline",
  "스프린트 파이프라인",
)
  .description("Think → Plan → Build → Review → Debug → Ship → Reflect")
  .subFlowGate("think", "생각 (Office Hours)", "perceive", "office-hours")
  .subFlowGate("plan-strategy", "전략 계획 (CEO Review)", "plan", "ceo-review")
  .subFlowGate("plan-tech", "기술 계획 (Eng Review)", "plan", "eng-review")
  .subFlowGate("plan-design", "설계 계획 (Design Review)", "evaluate", "design-review")
  .subFlowGate("build", "구현", "execute", "build")
  .subFlowGate("review", "코드 리뷰", "evaluate", "code-review")
  .subFlowGate("ship", "출시", "execute", "ship")
  .subFlowGate("reflect", "회고", "reflect", "reflect")
  .build();

// ─── Policies: Autoplan Auto-Decision ────────────────────

/**
 * gstack autoplan의 6 auto-decision principles를 FlowPolicy로 변환.
 *
 * 규칙:
 * 1. 확립된 패턴 → 자동 채택
 * 2. 완전 구현이 한계 비용 낮으면 → 완전 구현
 * 3. 테스트 추가 → 항상 승인
 * 4. 관측성 추가 → 항상 승인
 * 5. 보안 강화 → 항상 승인
 * 6. 위 5개 아님 → 인간 결정 (taste decision)
 */
export const AUTOPLAN_POLICIES: readonly FlowPolicy[] = [
  // Principle 1: 확립된 패턴 → 자동 채택
  {
    id: "auto-standard-arch",
    name: "표준 패턴 아키텍처 자동 승인",
    flowId: "eng-review",
    priority: 80,
    conditions: [
      { field: "context.isStandardPattern", op: "eq", value: true },
    ],
    action: {
      gateId: "architecture",
      branchId: "approved",
      confidence: 0.85,
    },
    rationale: "확립된 패턴은 자동 채택 (autoplan principle 1: standard-pattern)",
  },
  // Principle 2: 완전 구현 (boil the lake) → 자동
  {
    id: "auto-completeness",
    name: "완전 구현 자동 선택 (boil the lake)",
    flowId: "build",
    priority: 85,
    conditions: [
      { field: "context.marginalCostIsLow", op: "eq", value: true },
    ],
    action: {
      gateId: "implementation-scope",
      branchId: "full",
      confidence: 0.9,
    },
    rationale: "AI가 한계 비용을 0에 가깝게 만들었으면 완전 구현을 선택한다 (autoplan principle 2: completeness)",
  },
  // Principle 3: 테스트 추가 → 항상 승인
  {
    id: "auto-test-coverage",
    name: "테스트 추가 자동 승인",
    flowId: "eng-review",
    priority: 100,
    conditions: [
      { field: "context.changeType", op: "eq", value: "test-addition" },
    ],
    action: {
      gateId: "test-strategy",
      branchId: "mixed",
      confidence: 0.95,
    },
    rationale: "테스트 추가는 항상 가치 있다 (autoplan principle 3: test-coverage)",
  },
  // Principle 4: 관측성 추가 → 항상 승인
  {
    id: "auto-observability",
    name: "관측성 추가 자동 승인",
    flowId: "eng-review",
    priority: 100,
    conditions: [
      { field: "context.changeType", op: "eq", value: "observability" },
    ],
    action: {
      gateId: "observability",
      branchId: "full-trace",
      confidence: 0.9,
    },
    rationale: "관측성 추가는 항상 가치 있다 (autoplan principle 4: observability)",
  },
  // Principle 5: 보안 강화 → 항상 승인
  {
    id: "auto-security",
    name: "보안 강화 자동 승인",
    flowId: "code-review",
    priority: 100,
    conditions: [
      { field: "context.changeType", op: "eq", value: "security" },
    ],
    action: {
      gateId: "action",
      branchId: "approve",
      confidence: 0.95,
    },
    rationale: "보안 강화는 항상 승인한다 (autoplan principle 5: security)",
  },
  // Principle 1 (code-review): 스코프 내 + 이슈 없음/자동수정 → 자동 승인
  {
    id: "auto-low-risk-approve",
    name: "저위험 자동 승인",
    flowId: "code-review",
    priority: 90,
    conditions: [
      { field: "gate.scope-drift.branch", op: "eq", value: "on-scope" },
      { field: "gate.severity.branch", op: "in", value: ["clean", "auto-fixable"] },
    ],
    action: {
      gateId: "action",
      branchId: "approve",
      confidence: 0.9,
    },
    rationale: "스코프 내 + 자동 수정 가능 = 자동 승인 (autoplan principle 1: standard-pattern)",
  },
];

// ─── All Flow Schemas ────────────────────────────────────

/** 전체 스프린트 파이프라인을 구성하는 FlowSchema 목록 */
export const ALL_SPRINT_FLOWS: readonly FlowSchema[] = [
  FORCING_QUESTIONS_FLOW,
  OFFICE_HOURS_FLOW,
  CEO_REVIEW_FLOW,
  ENG_REVIEW_FLOW,
  DESIGN_REVIEW_FLOW,
  CODE_REVIEW_FLOW,
  INVESTIGATION_FLOW,
  BUILD_FLOW,
  SHIP_FLOW,
  REFLECT_FLOW,
  SPRINT_PIPELINE,
];

/** FlowSchema ID → FlowSchema 매핑 */
export const SPRINT_FLOW_REGISTRY: ReadonlyMap<string, FlowSchema> = new Map(
  ALL_SPRINT_FLOWS.map((f) => [f.id, f]),
);
