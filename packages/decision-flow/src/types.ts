// @def.boundary df-model-group
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
  /** 의사결정 단위 — 이 플로우의 주제, 목적, 성공 기준 */
  readonly unit?: DecisionUnit;
}

// ─── 의사결정 단위 (Decision Unit) ────────────────────────

/**
 * 의사결정의 명확한 단위.
 *
 * 모든 의사결정은 세 가지가 명확해야 한다:
 * 1. topic — 무엇에 대한 결정인가
 * 2. objective — 이 결정으로 무엇을 달성하려 하는가
 * 3. successCriteria — 이 결정이 성공했다고 판단할 기준은 무엇인가
 *
 * 결정이 완료된 후 verdict로 성공 여부를 기록한다.
 * verdict가 없으면 아직 결론이 나지 않은 것.
 */
export interface DecisionUnit {
  /** 무엇에 대한 결정인가 (예: "event-catalog 패키지 추가 여부") */
  readonly topic: string;
  /** 이 결정으로 무엇을 달성하려 하는가 (예: "이벤트 정의 중복 제거 + 키 충돌 방지") */
  readonly objective: string;
  /** 성공 판단 기준 (예: "5개 서비스의 이벤트가 중앙 카탈로그에서 관리됨") */
  readonly successCriteria: readonly string[];
  /** 실패 시 대안 (선택적) */
  readonly fallback?: string;
}

/** 의사결정 판정 — 결정 완료 후 성공/실패/보류를 기록 */
export type DecisionVerdict = "success" | "failure" | "deferred" | "superseded";

/** 의사결정 판정 기록 */
export interface DecisionVerdictRecord {
  /** 판정 */
  readonly verdict: DecisionVerdict;
  /** 판정 근거 */
  readonly reason: string;
  /** 성공 기준 충족 여부 (기준별) */
  readonly criteriaResults: readonly { criterion: string; met: boolean; evidence?: string }[];
  /** 판정 시각 */
  readonly judgedAt: string;
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
 *
 * 생명주기:
 *   pending → active → completed → (시간 경과) → verdict 기록
 *   과정(active→completed)과 결론(verdict)은 시간축이 다르다.
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
  /** 완료 시점 관찰용 address_context 캐시 */
  readonly addressContext?: Record<string, string>;
  /** 의사결정 단위 (FlowSchema.unit의 스냅샷) */
  readonly unit?: DecisionUnit;
  /** 테스트 계획 — TEST_NEEDED_FLOW 판정에서 파생 (있으면) */
  readonly testPlan?: TestPlan;
  /** 사후 판정 — 완료 후 시간이 지나서 기록 (성공/실패/보류) */
  readonly verdict?: DecisionVerdictRecord;
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

// ─── 서사 (Decision Narrative) ────────────────────────────

/**
 * 의사결정 서사 — 개별 결정이 모여 결정 공간의 한 점에 도달하고,
 * 그 여정이 서사로 기록되는 구조.
 *
 * 흐름:
 *   배경(context) → 여정(journey) → 도달(destination) → 산출(outcome) → 회고(reflection)
 *
 * 배경:  왜 이 결정이 필요했는가 (비즈니스 요구, 관측, 사건)
 * 여정:  각 gate에서 무엇을 선택하고 왜 그랬는가 (개별 결정의 축적)
 * 도달:  결정 공간에서의 최종 위치 (좌표 주소 = 서사의 압축)
 * 산출:  이 결정이 만들어낸 것 (기술 구현, 변경, 문서)
 * 회고:  이 서사에서 배운 것 (패턴, 교훈, 열린 질문)
 *
 * 서사는 지워지지 않는다. 결정이 바뀌면 새 서사가 추가된다.
 */
/**
 * 의사결정 서사.
 *
 * 흐름:
 *   배경 → 여정 → 도달 → 산출 → [시간 경과] → 판정 → 회고
 *
 * 과정(배경~산출)과 결론(판정)은 시간축이 다르다.
 * 판정은 나중에 추가된다. 회고는 판정 후에야 의미가 있다.
 */
export interface DecisionNarrative {
  /** 서사 고유 ID */
  readonly id: string;
  /** 기록 시각 (ISO-8601) */
  readonly recordedAt: string;

  /** 의사결정 단위 — 이 결정의 주제/목적/성공 기준 (선택적) */
  readonly unit?: DecisionUnit;
  /** 배경: 왜 이 결정이 필요했는가 */
  readonly context: NarrativeContext;
  /** 여정: 개별 결정의 축적 — gate를 하나씩 통과하며 쌓인 선택들 */
  readonly journey: readonly NarrativeStep[];
  /** 도달: 결정 공간에서의 최종 위치 */
  readonly destination: NarrativeDestination;
  /** 산출: 이 결정이 만들어낸 것 */
  readonly outcome: NarrativeOutcome;
  /** 판정: 성공/실패/보류 — 산출 후 시간이 지나서 기록 (선택적) */
  readonly verdict?: DecisionVerdictRecord;
  /** 회고: 이 서사에서 배운 것 (선택적 — 판정 후 추가) */
  readonly reflection?: NarrativeReflection;
}

/** 배경 — 서사의 시작점 */
export interface NarrativeContext {
  /** 요구의 출처 (예: "capacity-alert", "feature-request", "tech-debt") */
  readonly source: string;
  /** 무엇이 이 결정을 촉발했는가 */
  readonly trigger: string;
  /** 관련 DKG 관측 ID (있으면) */
  readonly observationId?: string;
}

/** 여정의 한 걸음 — 하나의 gate에서의 선택 */
export interface NarrativeStep {
  /** gate ID */
  readonly gateId: string;
  /** gate 이름 */
  readonly gateName: string;
  /** 선택한 branch ID */
  readonly choice: string;
  /** 왜 이 선택을 했는가 (evidence에서 추출한 한 줄 요약) */
  readonly reason: string;
  /** 확신도 (0-1) */
  readonly confidence: number;
  /** 이 gate가 코어인가 (결정 공간의 주요 차원) */
  readonly isCore: boolean;
  /** 이 선택의 근거 유형 */
  readonly evidenceKinds: readonly string[];
}

/** 도달 — 결정 공간의 한 점 */
export interface NarrativeDestination {
  /** FlowInstance ID */
  readonly instanceId: string;
  /** 플로우 스키마 ID */
  readonly schemaId: string;
  /** 1D 정수 주소 — 서사 전체의 압축 (있으면) */
  readonly address?: number;
  /** gate별 선택 (decoded path) */
  readonly selections: Record<string, string>;
  /** 코어 gate 선택만 추출 — 서사의 핵심 */
  readonly coreSelections: Record<string, string>;
}

/** 산출 — 결정이 만들어낸 것 */
export interface NarrativeOutcome {
  /** 산출물 유형 (예: "axis", "prefix", "module", "config-change") */
  readonly artifactType: string;
  /** 산출물 참조 (예: 파일 경로, DKG 노드 ID 등) */
  readonly artifactRef: string;
  /** DKG DecisionNode ID (있으면) */
  readonly decisionNodeId?: string;
  /** 변경된 파일 목록 (구현 추적) */
  readonly filesChanged?: readonly string[];
  /** 관련 커밋 해시 (구현 추적) */
  readonly commits?: readonly string[];
  /** 테스트 결과 요약 (구현 추적) */
  readonly testResult?: NarrativeTestResult;
}

/** 테스트 결과 요약 */
export interface NarrativeTestResult {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  /** 실패 시 실패 테스트 목록 */
  readonly failedTests?: readonly string[];
}

// ─── 테스트 계획 (Test Plan) ──────────────────────────────

/**
 * 테스트 계획 — "무엇을, 어디서, 어떻게 테스트할 것인가"
 *
 * TEST_NEEDED_FLOW의 판정 결과에서 파생.
 * 의사결정(verdict) → 테스트 계획(plan) → 실행(result) → 판정(judge)의 흐름.
 */
export interface TestPlan {
  /** 테스트 필요 여부 판정에서 파생 */
  readonly sourceDecisionId: string;
  /** 판정 유형 (add-unit/add-integration/add-e2e/strengthen/not-needed) */
  readonly verdict: string;
  /** 테스트 대상 — 어떤 기능/모듈/파일을 테스트하는가 */
  readonly targets: readonly TestTarget[];
  /** 실행 명령 (있으면) */
  readonly runCommand?: string;
  /** 생성 시각 */
  readonly createdAt: string;
  /** 실행 결과 (테스트 실행 후 기록) */
  readonly result?: NarrativeTestResult;
  /** 실행 시각 */
  readonly executedAt?: string;
}

/** 테스트 대상 */
export interface TestTarget {
  /** 대상 유형 (file/module/api/flow) */
  readonly type: "file" | "module" | "api" | "flow";
  /** 대상 참조 (파일 경로, 모듈 이름 등) */
  readonly ref: string;
  /** 테스트 설명 */
  readonly description: string;
}

/** 회고 — 서사에서 배운 것 (나중에 추가 가능) */
export interface NarrativeReflection {
  /** 이 결정에서 발견된 패턴 (있으면) */
  readonly patternFound?: string;
  /** 다음에 비슷한 결정을 할 때 참고할 교훈 */
  readonly lesson?: string;
  /** 아직 답하지 못한 질문 */
  readonly openQuestions?: readonly string[];
}

// ─── 하위 호환: DecisionTrace (DecisionNarrative의 간소화 뷰) ──

/** DecisionTrace — DecisionNarrative의 X→좌표→Y 간소화 뷰 */
export interface DecisionTrace {
  readonly requirement: { source: string; description: string; observationId?: string };
  readonly coordinate: {
    instanceId: string;
    address?: number;
    selections: Record<string, string>;
    coreSelections: Record<string, string>;
    addressContext?: Record<string, string>;
  };
  readonly implementation: { artifactType: string; artifactRef: string; decisionNodeId?: string };
}
