/**
 * 의사결정 도메인 단어 정의 (Vocabulary)
 *
 * 좌표계의 축(axis)이 되는 유한한 단어 집합.
 * 각 축은 5Q Checklist를 통과해야 한다:
 *   Q1 유한? Q2 의사결정 관련? Q3 공유? Q4 안정? Q5 capacity 관리 가능?
 *
 * 모든 entries는 snake_case. capacity는 nextPowerOf2(entries.length * 2) 이상.
 */

/** VersionedAxis — @qa-sdk/core 호환 인터페이스 (의존 없이 자체 정의) */
export interface VersionedAxis {
  readonly id: string;
  readonly name: string;
  readonly versions: Record<string, {
    readonly entries: readonly string[];
    readonly capacity?: number;
    readonly ko?: Record<string, string>;
  }>;
}

// ─── 축 정의 ─────────────────────────────────────────────

/**
 * cognitive_phase — 인지 단계 (7 entries, capacity 16)
 *
 * 5Q: ✓유한 ✓의사결정(단계별 처리 다름) ✓공유(전 prefix) ✓안정(인지과학 기반) ✓capacity
 * 모든 의사결정 이벤트의 공통 차원.
 */
export const COGNITIVE_PHASE = {
  entries: ["perceive", "interpret", "evaluate", "decide", "plan", "execute", "reflect"] as const,
  capacity: 16,
  ko: {
    perceive: "인지", interpret: "해석", evaluate: "평가",
    decide: "결정", plan: "계획", execute: "실행", reflect: "성찰",
  },
} as const;

/**
 * flow_type — 의사결정 플로우 유형 (8 entries, capacity 16)
 *
 * 5Q: ✓유한 ✓의사결정 ✓공유(decision_event/path) ✓안정(느린 변화) ✓capacity
 */
export const FLOW_TYPE = {
  entries: [
    "office_hours", "ceo_review", "eng_review", "design_review",
    "code_review", "investigation", "ship", "custom",
  ] as const,
  capacity: 16,
  ko: {
    office_hours: "오피스아워", ceo_review: "전략리뷰", eng_review: "기술리뷰",
    design_review: "설계리뷰", code_review: "코드리뷰", investigation: "조사",
    ship: "출시", custom: "커스텀",
  },
} as const;

/**
 * evidence_kind — 근거 유형 (5 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(근거 유형이 결정 품질 좌우) ✓공유 ✓안정 ✓capacity
 */
export const EVIDENCE_KIND = {
  entries: ["data", "rule", "precedent", "intuition", "external"] as const,
  capacity: 16,
  ko: {
    data: "정량데이터", rule: "규칙", precedent: "선례",
    intuition: "직관", external: "외부입력",
  },
} as const;

/**
 * mental_model — 인지 프레임워크 (13 entries, capacity 16)
 *
 * 5Q: ✓유한 ✓의사결정(어떤 사고 도구 적용) △공유(model_apply) ✓안정 ✓capacity
 */
export const MENTAL_MODEL_AXIS = {
  entries: [
    "bezos_doors", "munger_inversion", "jobs_subtraction", "speed_calibration",
    "proxy_skepticism", "boil_the_lake", "three_layer", "narrative_coherence",
    "temporal_depth", "founder_mode", "wartime_awareness", "design_trust",
    "edge_paranoia",
  ] as const,
  capacity: 32,
  ko: {
    bezos_doors: "가역성분류", munger_inversion: "반전사고", jobs_subtraction: "초점빼기",
    speed_calibration: "속도보정", proxy_skepticism: "대리회의", boil_the_lake: "호수끓이기",
    three_layer: "3층지식", narrative_coherence: "서사일관", temporal_depth: "시간깊이",
    founder_mode: "파운더모드", wartime_awareness: "전시인식", design_trust: "신뢰설계",
    edge_paranoia: "엣지편집증",
  },
} as const;

/**
 * escalation_type — 자동 판정 원칙 / 에스컬레이션 사유 (6 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(왜 자동/수동) ✓공유 ✓안정 ✓capacity
 */
export const ESCALATION_TYPE = {
  entries: [
    "standard_pattern", "completeness", "test_coverage",
    "observability", "security", "taste",
  ] as const,
  capacity: 16,
  ko: {
    standard_pattern: "표준패턴", completeness: "완전구현", test_coverage: "테스트",
    observability: "관측성", security: "보안", taste: "미감결정",
  },
} as const;

/**
 * decision_outcome — 의사결정 결과 (5 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(결과 분류) ✓공유 ✓안정 ✓capacity
 */
export const DECISION_OUTCOME = {
  entries: ["completed", "abandoned", "blocked", "auto_resolved", "escalated"] as const,
  capacity: 16,
  ko: {
    completed: "완료", abandoned: "포기", blocked: "차단",
    auto_resolved: "자동해결", escalated: "에스컬레이션",
  },
} as const;

/**
 * scope_mode — 스코프 결정 모드 (4 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(핵심 분기) △공유(ceo_review 관련) ✓안정 ✓capacity
 */
export const SCOPE_MODE = {
  entries: ["expansion", "selective", "hold", "reduction"] as const,
  capacity: 8,
  ko: {
    expansion: "확장", selective: "선택적확장", hold: "유지", reduction: "축소",
  },
} as const;

/**
 * reversibility — 가역성 분류 (2 entries, capacity 4)
 *
 * 5Q: ✓유한 ✓의사결정(Bezos doors) ✓공유 ✓안정 ✓capacity
 */
export const REVERSIBILITY = {
  entries: ["one_way", "two_way"] as const,
  capacity: 4,
  ko: { one_way: "비가역", two_way: "가역" },
} as const;

/**
 * magnitude — 영향 범위 (4 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(영향×가역성=속도) ✓공유 ✓안정 ✓capacity
 */
export const MAGNITUDE = {
  entries: ["minor", "moderate", "major", "critical"] as const,
  capacity: 8,
  ko: { minor: "경미", moderate: "보통", major: "중대", critical: "치명" },
} as const;

/**
 * confidence_band — 이산화된 확신 수준 (4 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정 ✓공유 ✓안정 ✓capacity
 * 기존 pattern_confidence와 동일 구조.
 */
export const CONFIDENCE_BAND = {
  entries: ["low", "medium", "high", "exact"] as const,
  capacity: 8,
  ko: { low: "낮음", medium: "보통", high: "높음", exact: "정확" },
} as const;

/**
 * forcing_question — 강제 질문 식별자 (6 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(어떤 질문에 답하는가) △공유 ✓안정 ✓capacity
 */
export const FORCING_QUESTION_AXIS = {
  entries: [
    "demand_reality", "status_quo", "desperate_specificity",
    "narrowest_wedge", "observation", "future_fit",
  ] as const,
  capacity: 16,
  ko: {
    demand_reality: "수요현실", status_quo: "현재상태", desperate_specificity: "절박한구체성",
    narrowest_wedge: "최소쐐기", observation: "관찰", future_fit: "미래적합성",
  },
} as const;

// ─── VersionedAxis 변환 ──────────────────────────────────

/** 축 정의를 VersionedAxis 형식으로 변환 */
function toVersionedAxis(
  id: string,
  name: string,
  def: { entries: readonly string[]; capacity: number; ko: Record<string, string> },
): VersionedAxis {
  return {
    id,
    name,
    versions: {
      v1: { entries: def.entries, capacity: def.capacity, ko: def.ko },
    },
  };
}

/** 의사결정 도메인 전체 축 레지스트리 */
export const DECISION_AXES: Record<string, VersionedAxis> = {
  cognitive_phase:   toVersionedAxis("cognitive_phase", "인지 단계", COGNITIVE_PHASE),
  flow_type:         toVersionedAxis("flow_type", "플로우 유형", FLOW_TYPE),
  evidence_kind:     toVersionedAxis("evidence_kind", "근거 유형", EVIDENCE_KIND),
  mental_model:      toVersionedAxis("mental_model", "인지 모델", MENTAL_MODEL_AXIS),
  escalation_type:   toVersionedAxis("escalation_type", "에스컬레이션 유형", ESCALATION_TYPE),
  decision_outcome:  toVersionedAxis("decision_outcome", "결정 결과", DECISION_OUTCOME),
  scope_mode:        toVersionedAxis("scope_mode", "스코프 모드", SCOPE_MODE),
  reversibility:     toVersionedAxis("reversibility", "가역성", REVERSIBILITY),
  magnitude:         toVersionedAxis("magnitude", "영향 범위", MAGNITUDE),
  confidence_band:   toVersionedAxis("confidence_band", "확신 수준", CONFIDENCE_BAND),
  forcing_question:  toVersionedAxis("forcing_question", "강제 질문", FORCING_QUESTION_AXIS),
};

// ─── 연속값 이산화 ───────────────────────────────────────

/** 0-1 연속 confidence를 이산 band로 변환 */
export function discretizeConfidence(value: number): typeof CONFIDENCE_BAND.entries[number] {
  if (value >= 0.9) return "exact";
  if (value >= 0.7) return "high";
  if (value >= 0.4) return "medium";
  return "low";
}
