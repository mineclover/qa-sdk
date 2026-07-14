// @def.boundary df-system
/**
 * 계층(Layer) + 컨텍스트 바운더리(Context Boundary)
 *
 * 의사결정의 두 가지 구조적 문제를 해결한다:
 *
 * 1. 계층 — 전략 결정이 전술 결정을 제약한다 (하향 전파)
 *    전술 결정은 전략을 바꿀 수 없다 (상향 차단)
 *
 * 2. 경계 — "좌표 설계" 컨텍스트의 결정이 "서비스 운영" 컨텍스트에
 *    어떤 인터페이스로 노출되는가를 정의한다
 *
 * ┌─────────────────────────────────────────────────────┐
 * │ Layer 0: Strategic  "무엇을 만들 것인가"               │
 * │   office-hours, ceo-review                          │
 * │   ↓ constrains (scope, direction)                   │
 * ├─────────────────────────────────────────────────────┤
 * │ Layer 1: Tactical   "어떻게 만들 것인가"               │
 * │   eng-review, design-review                         │
 * │   ↓ constrains (architecture, patterns)             │
 * ├─────────────────────────────────────────────────────┤
 * │ Layer 2: Operational "올바르게 만들고 있는가"           │
 * │   code-review, investigation                        │
 * │   ↓ constrains (quality bar)                        │
 * ├─────────────────────────────────────────────────────┤
 * │ Layer 3: Execution  "출시한다"                        │
 * │   ship, deploy, canary                              │
 * └─────────────────────────────────────────────────────┘
 *
 * 규칙:
 * - 상위 계층의 결정은 하위 계층을 제약한다 (하향 전파)
 * - 하위 계층은 상위 계층을 변경할 수 없다 (상향 차단)
 * - 같은 계층 내 결정은 서로 참조할 수 있다 (수평 참조)
 * - 하위 → 상위 변경이 필요하면 에스컬레이션 (명시적 경계 횡단)
 */

import type { FlowSchema, FlowInstance } from './types.js';

// ─── 계층 (Layer) ────────────────────────────────────────

export type DecisionLayerId = 'strategic' | 'tactical' | 'operational' | 'execution';

export interface DecisionLayer {
  readonly id: DecisionLayerId;
  readonly level: number; // 0=strategic, 1=tactical, 2=operational, 3=execution
  readonly name: string;
  readonly description: string;
  /** 이 계층에 속하는 FlowSchema ID 목록 */
  readonly flowIds: readonly string[];
}

export const DECISION_LAYERS: readonly DecisionLayer[] = [
  {
    id: 'strategic',
    level: 0,
    name: '전략',
    description: '무엇을 만들 것인가 — 방향과 범위를 결정',
    flowIds: ['office-hours', 'ceo-review'],
  },
  {
    id: 'tactical',
    level: 1,
    name: '전술',
    description: '어떻게 만들 것인가 — 아키텍처와 설계를 결정',
    flowIds: ['eng-review', 'design-review', 'coordinate-design'],
  },
  {
    id: 'operational',
    level: 2,
    name: '운영',
    description: '올바르게 만들고 있는가 — 품질과 정합성을 검증',
    flowIds: ['code-review', 'investigation'],
  },
  {
    id: 'execution',
    level: 3,
    name: '실행',
    description: '출시한다 — 배포와 검증을 수행',
    flowIds: ['ship'],
  },
];

/** flow ID → 소속 계층 조회 */
export function getLayerForFlow(flowId: string): DecisionLayer | undefined {
  return DECISION_LAYERS.find((l) => l.flowIds.includes(flowId));
}

// ─── 컨텍스트 바운더리 (Context Boundary) ────────────────

/**
 * 의사결정 컨텍스트 = 관련된 결정들의 경계.
 * DDD의 Bounded Context를 의사결정에 적용.
 *
 * 각 컨텍스트는:
 * - 자기 어휘(axes)와 플로우(flows)를 소유
 * - 외부에 발행하는 인터페이스(exports)를 정의
 * - 외부에서 수신하는 제약(imports)을 정의
 */
export interface DecisionContext {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 이 컨텍스트가 소유하는 FlowSchema ID 목록 */
  readonly ownedFlows: readonly string[];
  /** 이 컨텍스트가 소유하는 axis ID 목록 */
  readonly ownedAxes: readonly string[];
  /** 이 컨텍스트가 소유하는 prefix ID 목록 */
  readonly ownedPrefixes: readonly string[];
  /** 외부 컨텍스트에 발행하는 결정 (다른 컨텍스트가 읽을 수 있는 것) */
  readonly exports: readonly ContextExport[];
  /** 외부 컨텍스트에서 수신하는 제약 (이 컨텍스트를 제약하는 것) */
  readonly imports: readonly ContextImport[];
}

/** 컨텍스트가 외부에 발행하는 결정 */
export interface ContextExport {
  /** 발행 이름 (외부에서 참조하는 키) */
  readonly name: string;
  /** 어떤 flow의 어떤 gate 결정을 발행하는가 */
  readonly sourceFlowId: string;
  readonly sourceGateId: string;
  /** 발행 형태: value(선택값) 또는 constraint(제약 조건) */
  readonly kind: 'value' | 'constraint';
}

/** 컨텍스트가 외부에서 수신하는 제약 */
export interface ContextImport {
  /** 수신 이름 */
  readonly name: string;
  /** 어떤 컨텍스트에서 오는가 */
  readonly sourceContextId: string;
  /** 어떤 export를 참조하는가 */
  readonly sourceExportName: string;
  /** 이 제약이 적용되는 flow + gate */
  readonly targetFlowId: string;
  readonly targetGateId: string;
  /** 제약 유형 */
  readonly effect: 'constrains' | 'blocks' | 'informs';
}

// ─── 계층 간 제약 전파 ───────────────────────────────────

/** 계층 간 제약 위반 */
export interface LayerViolation {
  readonly kind: 'upward-mutation' | 'skip-layer' | 'boundary-crossing';
  readonly message: string;
  readonly sourceFlowId: string;
  readonly sourceLayer: DecisionLayerId;
  readonly targetFlowId: string;
  readonly targetLayer: DecisionLayerId;
}

/**
 * 계층 규칙을 검증한다.
 *
 * 규칙:
 * 1. 하위 계층 결정이 상위 계층 결정을 변경하면 upward-mutation
 * 2. 2단계 이상 건너뛰면 skip-layer (전략→운영: 전술 계층 누락)
 * 3. 컨텍스트 경계를 import 없이 횡단하면 boundary-crossing
 */
export function validateLayerConstraints(
  sourceFlowId: string,
  targetFlowId: string,
  effect: 'constrains' | 'invalidates' | 'enables',
  contexts?: readonly DecisionContext[],
): LayerViolation[] {
  const violations: LayerViolation[] = [];

  const sourceLayer = getLayerForFlow(sourceFlowId);
  const targetLayer = getLayerForFlow(targetFlowId);

  if (!sourceLayer || !targetLayer) return violations;

  // 규칙 1: 상향 변경 금지 (하위→상위 constrains/invalidates)
  if (sourceLayer.level > targetLayer.level && effect !== 'enables') {
    violations.push({
      kind: 'upward-mutation',
      message: `${sourceLayer.id}(level ${sourceLayer.level})에서 ${targetLayer.id}(level ${targetLayer.level})로의 상향 ${effect} 금지. 에스컬레이션 필요`,
      sourceFlowId,
      sourceLayer: sourceLayer.id,
      targetFlowId,
      targetLayer: targetLayer.id,
    });
  }

  // 규칙 2: 계층 건너뛰기 경고 (2단계 이상 차이)
  if (Math.abs(sourceLayer.level - targetLayer.level) > 1) {
    violations.push({
      kind: 'skip-layer',
      message: `${sourceLayer.id} → ${targetLayer.id}: 중간 계층(${DECISION_LAYERS.find((l) => l.level === Math.min(sourceLayer.level, targetLayer.level) + 1)?.id})을 건너뛴다`,
      sourceFlowId,
      sourceLayer: sourceLayer.id,
      targetFlowId,
      targetLayer: targetLayer.id,
    });
  }

  // 규칙 3: 컨텍스트 경계 횡단 검증
  if (contexts) {
    const sourceCtx = contexts.find((c) => c.ownedFlows.includes(sourceFlowId));
    const targetCtx = contexts.find((c) => c.ownedFlows.includes(targetFlowId));

    if (sourceCtx && targetCtx && sourceCtx.id !== targetCtx.id) {
      // 다른 컨텍스트 간 영향 — import가 정의되어 있는가?
      const hasImport = targetCtx.imports.some((imp) => imp.sourceContextId === sourceCtx.id);
      if (!hasImport) {
        violations.push({
          kind: 'boundary-crossing',
          message: `${sourceCtx.id} → ${targetCtx.id} 경계 횡단: import가 정의되지 않음`,
          sourceFlowId,
          sourceLayer: sourceLayer.id,
          targetFlowId,
          targetLayer: targetLayer.id,
        });
      }
    }
  }

  return violations;
}

// ─── 스코프 상속 ─────────────────────────────────────────

/**
 * 상위 계층의 결정을 하위 계층의 컨텍스트로 전파한다.
 *
 * 예: ceo-review에서 scope-mode=expansion → eng-review의 컨텍스트에
 *     { inherited_scope_mode: "expansion" } 주입
 *
 * @param parentInstance - 상위 계층 플로우 인스턴스
 * @param parentSchema - 상위 계층 플로우 스키마
 * @param childFlowId - 하위 계층 플로우 ID
 * @param exports - 상위 컨텍스트의 export 정의
 * @returns 하위 플로우에 주입할 inherited context
 */
export function propagateScope(
  parentInstance: FlowInstance,
  parentSchema: FlowSchema,
  childFlowId: string,
  exports: readonly ContextExport[],
): Record<string, unknown> {
  const parentLayer = getLayerForFlow(parentInstance.schemaId);
  const childLayer = getLayerForFlow(childFlowId);

  // 상위→하위 방향만 전파
  if (!parentLayer || !childLayer || parentLayer.level >= childLayer.level) {
    return {};
  }

  const inherited: Record<string, unknown> = {};

  for (const exp of exports) {
    if (exp.sourceFlowId !== parentInstance.schemaId) continue;

    const selection = parentInstance.selections.find((s) => s.gateId === exp.sourceGateId);
    if (!selection) continue;

    if (exp.kind === 'value') {
      inherited[`inherited_${exp.name}`] = selection.branchId;
    } else if (exp.kind === 'constraint') {
      inherited[`constraint_${exp.name}`] = {
        gateId: exp.sourceGateId,
        branchId: selection.branchId,
        fromLayer: parentLayer.id,
        fromFlow: parentInstance.schemaId,
      };
    }
  }

  return inherited;
}

// ─── 경계 횡단 요청 (에스컬레이션) ───────────────────────

/** 하위 → 상위 경계 횡단 요청 */
export interface EscalationRequest {
  readonly id: string;
  /** 요청을 발생시킨 컨텍스트 */
  readonly sourceContextId: string;
  readonly sourceFlowId: string;
  readonly sourceGateId: string;
  /** 변경을 요청하는 대상 */
  readonly targetContextId: string;
  readonly targetFlowId: string;
  readonly targetGateId: string;
  /** 왜 상위 결정을 변경해야 하는가 */
  readonly rationale: string;
  /** 요청하는 변경 내용 */
  readonly requestedBranch: string;
  /** 현재 상태 */
  readonly status: 'pending' | 'approved' | 'rejected' | 'deferred';
}

/**
 * 하위 계층에서 상위 계층 결정의 변경이 필요할 때
 * 명시적 에스컬레이션 요청을 생성한다.
 *
 * 직접 변경하지 않고 요청을 만드는 이유:
 * 상위 결정은 cascade 영향이 크므로 명시적 승인이 필요하다.
 */
export function createEscalationRequest(
  sourceContext: DecisionContext,
  targetContext: DecisionContext,
  sourceFlowId: string,
  sourceGateId: string,
  targetFlowId: string,
  targetGateId: string,
  requestedBranch: string,
  rationale: string,
): EscalationRequest {
  return {
    id: `ESC-${sourceContext.id}-${targetContext.id}-${Date.now()}`,
    sourceContextId: sourceContext.id,
    sourceFlowId,
    sourceGateId,
    targetContextId: targetContext.id,
    targetFlowId,
    targetGateId,
    rationale,
    requestedBranch,
    status: 'pending',
  };
}
