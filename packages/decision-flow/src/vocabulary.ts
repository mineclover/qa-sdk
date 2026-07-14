// @def.boundary df-model-group
/**
 * 의사결정 도메인 축 정의 (Vocabulary)
 *
 * 소프트웨어/시스템 설계에서 반복되는 의사결정 과정의 핵심 축을 사전 정의한다.
 * 개별 결정은 일회성처럼 보이지만, 축으로 투영하면 반복 패턴이 드러난다.
 *
 * 각 축은 두 단계를 통과해야 한다:
 *   1. 자격 검증 (5Q): 유한? 의사결정 관련? 공유? 안정? capacity 관리 가능?
 *   2. 설명력 판단: 결정의 "왜"를 얼마나 잘 구분하는가? 기존 축과 직교하는가?
 *
 * 모든 entries는 snake_case. capacity는 nextPowerOf2(entries.length * 2) 이상.
 */

/** VersionedAxis — @qa-sdk/core 호환 인터페이스 (의존 없이 자체 정의) */
export interface VersionedAxis {
  readonly id: string;
  readonly name: string;
  readonly versions: Record<
    string,
    {
      readonly entries: readonly string[];
      readonly capacity?: number;
      readonly ko?: Record<string, string>;
    }
  >;
}

// ─── 축 설명력 메타데이터 ─────────────────────────────────

/**
 * 축의 설명력 역할.
 *
 * primary:     결정의 구조를 결정하는 축 — 이 축이 다르면 결정의 성격이 근본적으로 달라진다
 * secondary:   결정의 성격을 한정하는 축 — primary 내에서 세부 분류를 제공
 * contextual:  결정의 강도/상황을 측정하는 축 — 결정 자체보다 결정의 메타 정보
 */
export type ExplanatoryRole = 'primary' | 'secondary' | 'contextual';

/**
 * 축의 설명력 메타데이터.
 *
 * 5Q가 축의 "자격"을 검증한다면, 이 메타데이터는 축의 "의미"를 기술한다.
 * - 이 축이 결정의 어떤 측면을 설명하는가 (explains)
 * - 왜 다른 후보 축보다 설명력이 높은가 (designRationale)
 * - 어떤 축과 독립인가 (orthogonalTo)
 */
export interface AxisExplanatoryMeta {
  /** 설명력 역할 (primary > secondary > contextual) */
  readonly role: ExplanatoryRole;
  /** 이 축이 결정의 어떤 측면을 설명하는가 */
  readonly explains: string;
  /** 왜 이 축이 다른 후보보다 설명력이 높은가 */
  readonly designRationale: string;
  /** 직교 관계가 보장되는 축 ID 목록 */
  readonly orthogonalTo: readonly string[];
}

// ─── 축 정의 ─────────────────────────────────────────────

/**
 * cognitive_phase — 인지 단계 (7 entries, capacity 16)
 *
 * 5Q: ✓유한 ✓의사결정(단계별 처리 다름) ✓공유(전 prefix) ✓안정(인지과학 기반) ✓capacity
 * 모든 의사결정 이벤트의 공통 차원.
 */
export const COGNITIVE_PHASE = {
  entries: ['perceive', 'interpret', 'evaluate', 'decide', 'plan', 'execute', 'reflect'] as const,
  capacity: 16,
  ko: {
    perceive: '인지',
    interpret: '해석',
    evaluate: '평가',
    decide: '결정',
    plan: '계획',
    execute: '실행',
    reflect: '성찰',
  },
} as const;

/**
 * flow_type — 의사결정 플로우 유형 (8 entries, capacity 16)
 *
 * 5Q: ✓유한 ✓의사결정 ✓공유(decision_event/path) ✓안정(느린 변화) ✓capacity
 */
export const FLOW_TYPE = {
  entries: [
    'office_hours',
    'ceo_review',
    'eng_review',
    'design_review',
    'code_review',
    'investigation',
    'ship',
    'custom',
  ] as const,
  capacity: 16,
  ko: {
    office_hours: '오피스아워',
    ceo_review: '전략리뷰',
    eng_review: '기술리뷰',
    design_review: '설계리뷰',
    code_review: '코드리뷰',
    investigation: '조사',
    ship: '출시',
    custom: '커스텀',
  },
} as const;

/**
 * evidence_kind — 근거 유형 (5 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(근거 유형이 결정 품질 좌우) ✓공유 ✓안정 ✓capacity
 */
export const EVIDENCE_KIND = {
  entries: ['data', 'rule', 'precedent', 'intuition', 'external'] as const,
  capacity: 16,
  ko: {
    data: '정량데이터',
    rule: '규칙',
    precedent: '선례',
    intuition: '직관',
    external: '외부입력',
  },
} as const;

/**
 * mental_model — 인지 프레임워크 (13 entries, capacity 16)
 *
 * 5Q: ✓유한 ✓의사결정(어떤 사고 도구 적용) △공유(model_apply) ✓안정 ✓capacity
 */
export const MENTAL_MODEL_AXIS = {
  entries: [
    'bezos_doors',
    'munger_inversion',
    'jobs_subtraction',
    'speed_calibration',
    'proxy_skepticism',
    'boil_the_lake',
    'three_layer',
    'narrative_coherence',
    'temporal_depth',
    'founder_mode',
    'wartime_awareness',
    'design_trust',
    'edge_paranoia',
  ] as const,
  capacity: 32,
  ko: {
    bezos_doors: '가역성분류',
    munger_inversion: '반전사고',
    jobs_subtraction: '초점빼기',
    speed_calibration: '속도보정',
    proxy_skepticism: '대리회의',
    boil_the_lake: '호수끓이기',
    three_layer: '3층지식',
    narrative_coherence: '서사일관',
    temporal_depth: '시간깊이',
    founder_mode: '파운더모드',
    wartime_awareness: '전시인식',
    design_trust: '신뢰설계',
    edge_paranoia: '엣지편집증',
  },
} as const;

/**
 * escalation_type — 자동 판정 원칙 / 에스컬레이션 사유 (6 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(왜 자동/수동) ✓공유 ✓안정 ✓capacity
 */
export const ESCALATION_TYPE = {
  entries: [
    'standard_pattern',
    'completeness',
    'test_coverage',
    'observability',
    'security',
    'taste',
  ] as const,
  capacity: 16,
  ko: {
    standard_pattern: '표준패턴',
    completeness: '완전구현',
    test_coverage: '테스트',
    observability: '관측성',
    security: '보안',
    taste: '미감결정',
  },
} as const;

/**
 * decision_outcome — 의사결정 결과 (5 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(결과 분류) ✓공유 ✓안정 ✓capacity
 */
export const DECISION_OUTCOME = {
  entries: ['completed', 'abandoned', 'blocked', 'auto_resolved', 'escalated'] as const,
  capacity: 16,
  ko: {
    completed: '완료',
    abandoned: '포기',
    blocked: '차단',
    auto_resolved: '자동해결',
    escalated: '에스컬레이션',
  },
} as const;

/**
 * scope_mode — 스코프 결정 모드 (4 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(핵심 분기) △공유(ceo_review 관련) ✓안정 ✓capacity
 */
export const SCOPE_MODE = {
  entries: ['expansion', 'selective', 'hold', 'reduction'] as const,
  capacity: 8,
  ko: {
    expansion: '확장',
    selective: '선택적확장',
    hold: '유지',
    reduction: '축소',
  },
} as const;

/**
 * reversibility — 가역성 분류 (2 entries, capacity 4)
 *
 * 5Q: ✓유한 ✓의사결정(Bezos doors) ✓공유 ✓안정 ✓capacity
 */
export const REVERSIBILITY = {
  entries: ['one_way', 'two_way'] as const,
  capacity: 4,
  ko: { one_way: '비가역', two_way: '가역' },
} as const;

/**
 * magnitude — 영향 범위 (4 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(영향×가역성=속도) ✓공유 ✓안정 ✓capacity
 */
export const MAGNITUDE = {
  entries: ['minor', 'moderate', 'major', 'critical'] as const,
  capacity: 8,
  ko: { minor: '경미', moderate: '보통', major: '중대', critical: '치명' },
} as const;

/**
 * confidence_band — 이산화된 확신 수준 (4 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정 ✓공유 ✓안정 ✓capacity
 * 기존 pattern_confidence와 동일 구조.
 */
export const CONFIDENCE_BAND = {
  entries: ['low', 'medium', 'high', 'exact'] as const,
  capacity: 8,
  ko: { low: '낮음', medium: '보통', high: '높음', exact: '정확' },
} as const;

/**
 * forcing_question — 강제 질문 식별자 (6 entries, capacity 8)
 *
 * 5Q: ✓유한 ✓의사결정(어떤 질문에 답하는가) △공유 ✓안정 ✓capacity
 */
export const FORCING_QUESTION_AXIS = {
  entries: [
    'demand_reality',
    'status_quo',
    'desperate_specificity',
    'narrowest_wedge',
    'observation',
    'future_fit',
  ] as const,
  capacity: 16,
  ko: {
    demand_reality: '수요현실',
    status_quo: '현재상태',
    desperate_specificity: '절박한구체성',
    narrowest_wedge: '최소쐐기',
    observation: '관찰',
    future_fit: '미래적합성',
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
  cognitive_phase: toVersionedAxis('cognitive_phase', '인지 단계', COGNITIVE_PHASE),
  flow_type: toVersionedAxis('flow_type', '플로우 유형', FLOW_TYPE),
  evidence_kind: toVersionedAxis('evidence_kind', '근거 유형', EVIDENCE_KIND),
  mental_model: toVersionedAxis('mental_model', '인지 모델', MENTAL_MODEL_AXIS),
  escalation_type: toVersionedAxis('escalation_type', '에스컬레이션 유형', ESCALATION_TYPE),
  decision_outcome: toVersionedAxis('decision_outcome', '결정 결과', DECISION_OUTCOME),
  scope_mode: toVersionedAxis('scope_mode', '스코프 모드', SCOPE_MODE),
  reversibility: toVersionedAxis('reversibility', '가역성', REVERSIBILITY),
  magnitude: toVersionedAxis('magnitude', '영향 범위', MAGNITUDE),
  confidence_band: toVersionedAxis('confidence_band', '확신 수준', CONFIDENCE_BAND),
  forcing_question: toVersionedAxis('forcing_question', '강제 질문', FORCING_QUESTION_AXIS),
};

// ─── 축 설명력 레지스트리 ──────────────────────────────────

/**
 * 11개 축의 설명력 메타데이터.
 *
 * 소프트웨어 설계 의사결정에서 반복되는 패턴을 가장 잘 구분하는
 * 주성분(principal component)으로서의 근거를 기록한다.
 */
export const AXIS_META: Record<string, AxisExplanatoryMeta> = {
  // ── Primary: 결정의 구조를 결정 ──

  cognitive_phase: {
    role: 'primary',
    explains: '결정이 어떤 인지 과정에서 발생했는가',
    designRationale:
      '같은 결론이라도 perceive에서 한 것과 reflect에서 한 것은 품질이 다르다. ' +
      '단계가 다르면 필요한 근거 유형이 달라진다. ' +
      '후보 축 decision_speed(빠름/보통/느림)보다 설명력이 높은 이유: ' +
      '속도는 phase의 파생값이지 독립 차원이 아니다',
    orthogonalTo: ['evidence_kind', 'flow_type', 'confidence_band', 'escalation_type'],
  },
  flow_type: {
    role: 'primary',
    explains: '결정이 어떤 맥락의 플로우에서 발생했는가',
    designRationale:
      "전략 리뷰(ceo_review)의 '위험 높음'과 코드 리뷰(code_review)의 '위험 높음'은 의미가 다르다. " +
      '플로우 유형이 결정의 해석 프레임을 결정한다',
    orthogonalTo: [
      'cognitive_phase',
      'evidence_kind',
      'escalation_type',
      'decision_outcome',
      'scope_mode',
    ],
  },
  evidence_kind: {
    role: 'primary',
    explains: '결정의 근거 유형이 무엇인가',
    designRationale:
      'data 근거의 결정과 intuition 근거의 결정은 검증 방법이 다르다. ' +
      '결정의 재현 가능성을 결정하는 핵심 축. ' +
      '후보 축 evidence_count(근거 수)보다 설명력이 높은 이유: ' +
      '수가 아니라 종류가 결정 품질을 좌우한다',
    orthogonalTo: ['cognitive_phase', 'flow_type', 'confidence_band', 'forcing_question'],
  },

  // ── Secondary: 결정의 성격을 한정 ──

  mental_model: {
    role: 'secondary',
    explains: '어떤 사고 도구로 판단했는가',
    designRationale:
      '같은 정보를 bezos-doors로 보면 속도 결정, munger-inversion으로 보면 리스크 회피가 된다. ' +
      '사고 도구가 결정의 방향을 틀어놓는다',
    orthogonalTo: ['reversibility', 'magnitude'],
  },
  escalation_type: {
    role: 'secondary',
    explains: '왜 자동 판정이 실패했는가',
    designRationale:
      '자동화 가능 영역과 인간 개입 필수 영역을 구분하는 축. ' +
      '에스컬레이션 사유에 따라 자동화 전략이 달라진다',
    orthogonalTo: ['flow_type', 'cognitive_phase'],
  },
  decision_outcome: {
    role: 'secondary',
    explains: '결정이 어떤 결과로 끝났는가',
    designRationale:
      '결정 경로의 최종 상태. 학습 루프의 피드백 신호. ' +
      '같은 경로여도 completed와 abandoned는 다음 결정에 주는 교훈이 다르다',
    orthogonalTo: ['flow_type', 'scope_mode'],
  },
  scope_mode: {
    role: 'secondary',
    explains: '결정의 범위 전략이 무엇인가',
    designRationale:
      'expansion/selective/hold/reduction — 결정의 방향성을 구분. ' +
      '같은 기술 결정이라도 확장 중인지 축소 중인지에 따라 의미가 달라진다',
    orthogonalTo: ['decision_outcome', 'flow_type'],
  },

  // ── Contextual: 결정의 강도/상황 측정 ──

  reversibility: {
    role: 'contextual',
    explains: '결정이 되돌릴 수 있는가',
    designRationale:
      'one-way/two-way — Bezos Doors 프레임워크. ' +
      '결정 속도를 보정하는 메타 축. two-way이면 70% 정보로 충분',
    orthogonalTo: ['magnitude', 'mental_model'],
  },
  magnitude: {
    role: 'contextual',
    explains: '결정의 영향 범위가 얼마인가',
    designRationale:
      'minor~critical — reversibility와 교차하여 결정 전략을 결정. ' +
      'two-way이면서 critical일 수 있다 (대규모 A/B 테스트)',
    orthogonalTo: ['reversibility', 'mental_model'],
  },
  confidence_band: {
    role: 'contextual',
    explains: '결정의 확신도',
    designRationale:
      'low~exact — evidence weight의 이산화. ' +
      '패턴 학습의 임계값이자 자동 선택 가능 여부의 기준',
    orthogonalTo: ['cognitive_phase', 'evidence_kind', 'forcing_question'],
  },
  forcing_question: {
    role: 'contextual',
    explains: '어떤 강제 질문에 답했는가',
    designRationale:
      'Office Hours 6 Forcing Questions — 전략 결정의 구조화된 입력. ' +
      '질문이 다르면 같은 정보에서도 다른 결정이 나온다',
    orthogonalTo: ['evidence_kind', 'confidence_band'],
  },
};

// ─── 연속값 이산화 ───────────────────────────────────────

/** 0-1 연속 confidence를 이산 band로 변환 */
export function discretizeConfidence(value: number): (typeof CONFIDENCE_BAND.entries)[number] {
  if (value >= 0.9) return 'exact';
  if (value >= 0.7) return 'high';
  if (value >= 0.4) return 'medium';
  return 'low';
}
