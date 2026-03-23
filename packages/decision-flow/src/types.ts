/**
 * decision-flow — 의사결정 분기 관리 시스템 핵심 타입
 *
 * 의사결정 과정을 좌표 공간으로 모델링한다.
 * Gate(분기점) = Axis, Branch(선택지) = Entry, Path(경로) = 1D Address
 */

// ─── 인지 단계 ───────────────────────────────────────────

/**
 * 분기점의 인지적 성격.
 * "계획한다"도 하나의 인지 단계(plan)이다.
 */
export type CognitivePhase =
  | "perceive"   // 인지: 정보 수집, 관찰
  | "interpret"  // 해석: 정보의 의미 파악
  | "evaluate"   // 평가: 선택지 비교 분석
  | "decide"     // 결정: 분기 선택
  | "plan"       // 계획: 실행 방법 구체화
  | "execute"    // 실행: 선택 이행
  | "reflect";   // 성찰: 결과 회고

// ─── 근거 체계 ───────────────────────────────────────────

/** 근거 유형 */
export type EvidenceKind =
  | "data"       // 정량적 데이터
  | "rule"       // 규칙/정책 기반
  | "precedent"  // 선례 기반
  | "intuition"  // 직관/경험
  | "external";  // 외부 입력

/** 분기 선택의 근거 */
export interface Evidence {
  readonly kind: EvidenceKind;
  readonly source: string;                    // 근거 출처
  readonly content: string;                   // 근거 내용
  readonly weight: number;                    // 0-1, 의사결정에 미친 영향도
  readonly metadata?: Record<string, unknown>;
}

// ─── 조건 ────────────────────────────────────────────────

/** 정책/분기 평가용 조건 */
export interface Condition {
  readonly field: string;   // "gate.risk.branch" 또는 "context.hours"
  readonly op: "eq" | "neq" | "in" | "gt" | "lt" | "gte" | "lte" | "exists";
  readonly value: unknown;
}

// ─── 플로우 스키마 (정적 정의) ────────────────────────────

/** 선택지(Branch) = 한 분기점에서의 선택 옵션 */
export interface BranchSchema {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  /** 이 분기가 적용되는 사전 조건 */
  readonly conditions?: readonly Condition[];
  /** 순차 순서를 무시하고 특정 gate로 점프 */
  readonly nextGateId?: string;
  /** 이 분기 선택 시 플로우 즉시 종료 */
  readonly terminal?: boolean;
}

// ─── 구조적 무게 (Structural Weight) ─────────────────────

/**
 * 분기점의 구조적 영향도.
 *
 * core: 이 결정이 후속 모든 결정의 방향을 바꾼다. 되돌리려면 전체 재실행.
 *       예: scope-mode(확장/축소), 축 정의(5Q), prefix 생성
 *
 * structural: 다수의 후속 결정에 영향. 되돌리면 연쇄 변경.
 *             예: architecture(extend/refactor), risk-level
 *
 * tactical: 국소적 영향. 독립적으로 되돌릴 수 있다.
 *           예: test-strategy, observability-level
 */
export type GateWeight = "core" | "structural" | "tactical";

/**
 * gate 간 인과 의존.
 * "이 gate의 선택이 저 gate의 선택 범위를 결정한다"
 */
export interface GateDependency {
  /** 의존 대상 gate ID */
  readonly gateId: string;
  /** 의존 성격 */
  readonly kind:
    | "constrains"   // 이 gate가 대상 gate의 선택 범위를 제약
    | "enables"      // 이 gate의 특정 branch가 대상 gate를 활성화
    | "invalidates"; // 이 gate를 변경하면 대상 gate를 무효화
}

/** 분기점(Gate) = 하나의 의사결정 지점 */
export interface GateSchema {
  readonly id: string;
  readonly name: string;
  readonly phase: CognitivePhase;
  /** 이 gate에서 선택 가능한 분기들 (subFlowId 없을 때 사용) */
  readonly branches?: readonly BranchSchema[];
  /** 다른 FlowSchema를 참조 (prefix_ref와 동일 개념) */
  readonly subFlowId?: string;
  /** 이 gate에서 수집해야 하는 근거 유형 */
  readonly requiredEvidence?: readonly EvidenceKind[];
  /** 적용할 인지 프레임워크 (mental-model.ts의 MentalModelId) */
  readonly mentalModels?: readonly string[];
  /**
   * 구조적 무게. 생략 시 "tactical".
   * core gate는 변경 시 전체 재실행이 필요한 핵심 분기점.
   */
  readonly weight?: GateWeight;
  /**
   * 이 gate가 다른 gate에 미치는 인과 의존.
   * "이 gate를 바꾸면 무엇이 영향받는가"
   */
  readonly affects?: readonly GateDependency[];
  /** 생략 가능한 gate */
  readonly optional?: boolean;
  /** gate 처리 제한 시간 (ms) */
  readonly timeoutMs?: number;
}

/** 플로우의 결과 정의 */
export interface OutcomeSchema {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

/**
 * FlowSchema = 의사결정 과정의 정적 정의.
 * Catalog의 PrefixDef에 대응한다.
 *
 * gates의 각 항목이 축(axis), 각 gate의 branches가 엔트리(entry).
 * 전체 조합이 주소 공간을 형성한다.
 */
export interface FlowSchema {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly gates: readonly GateSchema[];
  readonly outcomes?: readonly OutcomeSchema[];
}

// ─── 플로우 인스턴스 (런타임) ─────────────────────────────

/** 플로우 실행 상태 */
export type FlowStatus =
  | "pending"     // 시작 전
  | "active"      // 진행 중
  | "completed"   // 정상 완료
  | "abandoned"   // 포기
  | "blocked";    // 외부 요인으로 차단

/** 한 gate에서의 실제 선택 */
export interface GateSelection {
  readonly gateId: string;
  readonly branchId: string;
  readonly evidence: readonly Evidence[];
  readonly confidence: number;          // 0-1
  readonly timestamp: string;           // ISO-8601
  readonly durationMs: number;          // 이 gate에서 결정까지 걸린 시간
  /** subFlow gate인 경우, 하위 플로우 인스턴스 ID */
  readonly subFlowInstanceId?: string;
  /** 이 선택의 원인이 된 이전 gate 선택 (인과 추적) */
  readonly causedBy?: readonly string[];
}

/**
 * FlowInstance = 의사결정 과정의 구체적 실행.
 * 완료 시 coordinateAddress에 전체 경로가 1D 정수로 인코딩된다.
 */
export interface FlowInstance {
  readonly id: string;
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly status: FlowStatus;
  readonly context: Record<string, unknown>;
  readonly selections: readonly GateSelection[];
  readonly outcome?: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  /** 전체 결정 경로를 좌표로 인코딩한 값 */
  readonly coordinateAddress?: number;
}

// ─── 정책 ────────────────────────────────────────────────

/** 정책 실행 결과 */
export interface PolicyAction {
  readonly gateId: string;
  readonly branchId: string;
  /** 정책 기반 자동 선택의 신뢰도 */
  readonly confidence: number;
}

/**
 * FlowPolicy = 반복 결정의 자동화 규칙.
 * 조건이 충족되면 특정 gate의 분기를 자동 선택한다.
 */
export interface FlowPolicy {
  readonly id: string;
  readonly name: string;
  readonly flowId: string;
  readonly priority: number;             // 높을수록 우선
  readonly conditions: readonly Condition[];
  readonly action: PolicyAction;
  readonly rationale: string;
}

// ─── 좌표 매핑 ───────────────────────────────────────────

/**
 * 플로우 스키마의 좌표 공간 정보.
 * WeightedIndex 생성에 필요한 shape/labels 제공.
 */
export interface FlowCoordinateSpace {
  readonly flowId: string;
  readonly shape: readonly number[];      // 각 gate의 분기 수 (capacity)
  readonly labels: readonly string[];     // gate IDs
  readonly totalPaths: number;            // shape 곱 = 전체 경로 수
  /** subFlow를 참조하는 gate 인덱스 → subFlowId 매핑 */
  readonly subFlowRefs: ReadonlyMap<number, string>;
}

/**
 * 디코딩된 결정 경로.
 * gate ID → 선택된 branch ID 매핑.
 */
export interface DecodedPath {
  readonly flowId: string;
  readonly address: number;
  readonly selections: Record<string, string>;
}
