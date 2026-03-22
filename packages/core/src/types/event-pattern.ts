/**
 * EventPattern — 이벤트 시퀀스의 의미적 패턴 분류.
 *
 * 패턴은 시나리오보다 상위 개념이다.
 *   - 시나리오: "로그인 → 장바구니 → 결제" (구체적 step 정의)
 *   - 패턴: "식별된 구매 행동" (시퀀스의 의미적 분류)
 *
 * 모든 세션은 완료 시점에 하나의 패턴으로 분류된다.
 * 분류 불가한 세션은 "unclassified" 패턴으로 태깅되어 이상 감지 대상이 된다.
 *
 * 좌표계 매핑:
 *   pattern_match prefix: svc_ref × identification_mode × behavior_pattern × pattern_confidence
 *   pattern_anomaly prefix: svc_ref × behavior_pattern
 */

// ── 식별 모드 ─────────────────────────────────────────

/** 행위 주체의 식별 수준 */
export type IdentificationMode =
  | "anonymous"       // actor 정보 없음. guest 브라우징
  | "identified"      // user_id 존재. 로그인 완료
  | "pseudonymized"   // actor_id만 있고 user_id 없음. 쿠키/토큰 기반
  | "service"         // 서비스 간 호출 (platform=node, owner_type=workspace)
  ;

// ── 행동 패턴 ─────────────────────────────────────────

/**
 * 세션 수준의 행동 패턴 분류.
 *
 * 비즈니스별로 자유 정의. catalog의 behavior_pattern 축 entries와 일치시킨다.
 * 예: 쇼핑 → "purchase_complete", 물류 → "delivery_completed", 금융 → "transaction_approved"
 *
 * 시스템 예약값: "unclassified" (규칙에 매칭되지 않는 패턴)
 */
export type BehaviorPattern = string;

// ── 패턴 매칭 신뢰도 ──────────────────────────────────

/** 패턴 분류의 신뢰도 */
export type PatternConfidence =
  | "exact"    // 모든 조건 만족. 의심 없음
  | "high"     // 핵심 조건 만족. 부분 시퀀스 불일치
  | "medium"   // 패턴 유사하나 일부 조건 미충족
  | "low"      // 최소 조건만 만족. 복수 패턴 후보
  | "unknown"  // 분류 불가. unclassified 태깅
  ;

// ── 패턴 규칙 ─────────────────────────────────────────

/** 패턴 분류 규칙 정의 */
export interface PatternRule {
  /** 규칙 고유 ID (예: "rule-identified-purchase") */
  readonly id: string;
  /** 식별 모드 조건 */
  readonly identificationMode: IdentificationMode | "any";
  /** 매칭 시 부여할 행동 패턴 */
  readonly behaviorPattern: BehaviorPattern;
  /** 매칭 조건 */
  readonly match: PatternMatchCondition;
  /** 매칭 시 기본 신뢰도 */
  readonly defaultConfidence: PatternConfidence;
  /** 규칙 우선순위 (높을수록 우선. 기본 0) */
  readonly priority?: number;
  /** 규칙 설명 */
  readonly description?: string;
}

/** 패턴 매칭 조건 */
export interface PatternMatchCondition {
  /** event_key 정규식 목록 (하나라도 매칭되면 후보) */
  readonly eventKeyPatterns?: readonly string[];
  /** 반드시 포함해야 하는 event_key 시퀀스 (순서 무관) */
  readonly requiredKeys?: readonly string[];
  /** 반드시 포함하면 안 되는 event_key */
  readonly excludedKeys?: readonly string[];
  /** 반드시 포함해야 하는 순서 있는 시퀀스 */
  readonly requiredSequence?: readonly string[];
  /** actor 조건 */
  readonly actorCondition?: "has_actor" | "no_actor" | "any";
  /** 최소 이벤트 수 */
  readonly minEvents?: number;
  /** 최대 이벤트 수 */
  readonly maxEvents?: number;
  /** 최대 세션 시간(ms). 초과 시 패턴 제외 */
  readonly maxDurationMs?: number;
  /** 최소 이벤트 간격의 최솟값(ms). 미만이면 봇 의심 */
  readonly minIntervalMs?: number;
}

// ── 패턴 분류 결과 ────────────────────────────────────

/** 단일 세션의 패턴 분류 결과 */
export interface PatternClassification {
  /** 매칭된 패턴 */
  readonly pattern: BehaviorPattern;
  /** 식별 모드 */
  readonly identificationMode: IdentificationMode;
  /** 매칭 신뢰도 */
  readonly confidence: PatternConfidence;
  /** 매칭된 규칙 ID */
  readonly matchedRuleId: string;
  /** 세션의 event_key 수 */
  readonly eventCount: number;
  /** 세션 시간(ms) */
  readonly durationMs: number;
  /** 패턴 분류 시각 */
  readonly classifiedAt: string;
}

// ── 이상 패턴 감지 ────────────────────────────────────

/** 이상 패턴 감지 결과 */
export interface PatternAnomaly {
  /** 이상 유형 */
  readonly kind: AnomalyKind;
  /** 관련 세션 ID */
  readonly sessionId: string;
  /** 이벤트 시퀀스 요약 */
  readonly eventSequence: readonly string[];
  /** 이상 설명 */
  readonly description: string;
  /** 심각도 */
  readonly severity: "info" | "warning" | "critical";
  /** 감지 시각 */
  readonly detectedAt: string;
}

/** 이상 패턴 유형 */
export type AnomalyKind =
  | "unclassified"        // 어떤 규칙에도 매칭 안 됨
  | "ratio_shift"         // 패턴 비율 급변 (예: browse 80%→20%)
  | "volume_spike"        // 특정 패턴 급증
  | "new_sequence"        // 이전에 없던 event_key 시퀀스
  | "abnormal_speed"      // 비정상 속도 (봇 의심)
  | "abnormal_duration"   // 비정상 세션 시간
  ;

// ── 패턴 통계 ─────────────────────────────────────────

/** 패턴별 집계 통계 */
export interface PatternStats {
  readonly pattern: BehaviorPattern;
  readonly identificationMode: IdentificationMode;
  readonly count: number;
  readonly percentage: number;
  readonly avgEventCount: number;
  readonly avgDurationMs: number;
  readonly lastSeen: string;
}

/** 패턴 건전성 보고서 */
export interface PatternHealthReport {
  /** 전체 분류된 세션 수 */
  readonly totalSessions: number;
  /** 패턴별 통계 */
  readonly stats: readonly PatternStats[];
  /** 분류율 (= 1 - unclassified 비율) */
  readonly classificationRate: number;
  /** 식별 비율 (identified + pseudonymized) */
  readonly identifiedRate: number;
  /** 감지된 이상 패턴 수 */
  readonly anomalyCount: number;
  /** 보고서 생성 시각 */
  readonly generatedAt: string;
}
