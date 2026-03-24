/**
 * FlowEngine — 의사결정 플로우 실행 엔진
 *
 * 스키마를 등록하고, 인스턴스를 생성하고, 분기점별 선택을 기록한다.
 * 완료 시 전체 경로를 좌표(1D 정수)로 인코딩한다.
 */

import { encodeSelections } from "./coordinate.js";
import { buildFlowCompletionContext } from "./ingest-adapter.js";
import type { InstanceStore } from "./instance-store.js";
import { tryAutoSelect } from "./policy.js";
import type {
  Evidence,
  FlowInstance,
  FlowPolicy,
  FlowSchema,
  FlowStatus,
  GateSchema,
  GateSelection,
} from "./types.js";

// ─── ID 생성 ─────────────────────────────────────────────

let instanceCounter = 0;

function generateInstanceId(schemaId: string): string {
  return `${schemaId}-${Date.now()}-${++instanceCounter}`;
}

// ─── FlowEngine ──────────────────────────────────────────

export class FlowEngine {
  private readonly schemas = new Map<string, FlowSchema>();
  private readonly instances = new Map<string, MutableFlowInstance>();
  private readonly policies = new Map<string, FlowPolicy[]>(); // flowId → policies
  private readonly subFlowCapacities = new Map<string, number>();
  private readonly instanceStore?: InstanceStore;

  constructor(options: FlowEngineOptions = {}) {
    this.instanceStore = options.instanceStore;
  }

  // ── 스키마 관리 ────────────────────────────────────────

  /** 플로우 스키마 등록 */
  registerSchema(schema: FlowSchema): void {
    this.schemas.set(schema.id, schema);
    // subFlow capacity 자동 계산 (subFlow가 없는 스키마만)
    if (schema.gates.every((g) => !g.subFlowId)) {
      const totalPaths = schema.gates.reduce((acc, g) => acc * (g.branches?.length ?? 1), 1);
      this.subFlowCapacities.set(schema.id, totalPaths);
    }
  }

  /** 등록된 스키마 조회 */
  getSchema(schemaId: string): FlowSchema | undefined {
    return this.schemas.get(schemaId);
  }

  /** 모든 등록된 스키마 목록 */
  listSchemas(): FlowSchema[] {
    return [...this.schemas.values()];
  }

  // ── 정책 관리 ──────────────────────────────────────────

  /** 정책 등록 */
  registerPolicy(policy: FlowPolicy): void {
    const existing = this.policies.get(policy.flowId) ?? [];
    existing.push(policy);
    this.policies.set(policy.flowId, existing);
  }

  /** 플로우별 등록된 정책 조회 */
  getPolicies(flowId: string): readonly FlowPolicy[] {
    return this.policies.get(flowId) ?? [];
  }

  // ── 인스턴스 생명주기 ──────────────────────────────────

  /**
   * 새 플로우 인스턴스를 시작한다.
   *
   * @param schemaId - 실행할 플로우 스키마 ID
   * @param context - 의사결정에 사용될 컨텍스트 데이터
   */
  startFlow(
    schemaId: string,
    context: Record<string, unknown> = {},
  ): FlowInstance {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`등록되지 않은 스키마: "${schemaId}"`);
    }

    const instance: MutableFlowInstance = {
      id: generateInstanceId(schemaId),
      schemaId,
      schemaVersion: schema.version,
      status: "active",
      context: { ...context },
      selections: [],
      startedAt: new Date().toISOString(),
    };

    this.instances.set(instance.id, instance);
    return toImmutable(instance);
  }

  /** 인스턴스 조회 */
  getInstance(instanceId: string): FlowInstance | undefined {
    const inst = this.instances.get(instanceId);
    return inst ? toImmutable(inst) : undefined;
  }

  // ── 분기 선택 ──────────────────────────────────────────

  /**
   * 현재 진행 중인 gate를 반환한다.
   *
   * 순차 모드: 선택되지 않은 첫 번째 gate를 반환.
   * 점프 모드: 직전 선택의 nextGateId를 따라간다.
   */
  getCurrentGate(instanceId: string): GateSchema | null {
    const instance = this.getInstanceOrThrow(instanceId);
    const schema = this.getSchemaOrThrow(instance.schemaId);

    if (instance.status !== "active") return null;

    // 직전 선택에 nextGateId가 있으면 그것을 따라감
    if (instance.selections.length > 0) {
      const lastSel = instance.selections[instance.selections.length - 1];
      const lastGate = schema.gates.find((g) => g.id === lastSel.gateId);
      if (lastGate?.branches) {
        const selectedBranch = lastGate.branches.find((b) => b.id === lastSel.branchId);
        if (selectedBranch?.terminal) return null; // 종료 분기
        if (selectedBranch?.nextGateId) {
          return schema.gates.find((g) => g.id === selectedBranch.nextGateId) ?? null;
        }
      }
    }

    // 순차 모드: 아직 선택되지 않은 첫 번째 gate
    const selectedGateIds = new Set(instance.selections.map((s) => s.gateId));
    return schema.gates.find((g) => !selectedGateIds.has(g.id)) ?? null;
  }

  /**
   * 특정 gate에서 분기를 선택한다.
   *
   * @param instanceId - 플로우 인스턴스 ID
   * @param branchId - 선택할 branch ID
   * @param evidence - 선택 근거 (선택적)
   * @param options - 추가 옵션
   */
  selectBranch(
    instanceId: string,
    branchId: string,
    evidence: Evidence[] = [],
    options: { confidence?: number; subFlowInstanceId?: string } = {},
  ): FlowInstance {
    const instance = this.getInstanceOrThrow(instanceId);
    if (instance.status !== "active") {
      throw new Error(`플로우가 active 상태가 아니다: "${instance.status}"`);
    }

    const currentGate = this.getCurrentGate(instanceId);
    if (!currentGate) {
      throw new Error("더 이상 선택할 gate가 없다");
    }

    // branch 유효성 검증 (일반 gate만)
    if (currentGate.branches) {
      const validBranch = currentGate.branches.find((b) => b.id === branchId);
      if (!validBranch) {
        throw new Error(
          `gate "${currentGate.id}"에서 유효하지 않은 branch: "${branchId}"`,
        );
      }
    }

    const selection: GateSelection = {
      gateId: currentGate.id,
      branchId,
      evidence,
      confidence: options.confidence ?? computeConfidence(evidence),
      timestamp: new Date().toISOString(),
      durationMs: 0, // 외부에서 측정하여 전달하는 것이 정확
      subFlowInstanceId: options.subFlowInstanceId,
    };

    instance.selections.push(selection);

    // 모든 gate 완료 확인
    const schema = this.getSchemaOrThrow(instance.schemaId);
    const selectedBranch = currentGate.branches?.find((b) => b.id === branchId);
    if (selectedBranch?.terminal || this.getCurrentGate(instanceId) === null) {
      this.completeFlowInternal(instance, schema);
    }

    return toImmutable(instance);
  }

  /**
   * 정책 기반으로 현재 gate의 분기를 자동 선택한다.
   *
   * @returns 자동 선택 성공 시 업데이트된 인스턴스, 실패 시 null
   */
  autoSelect(instanceId: string): FlowInstance | null {
    const instance = this.getInstanceOrThrow(instanceId);
    const currentGate = this.getCurrentGate(instanceId);
    if (!currentGate) return null;

    const policies = this.policies.get(instance.schemaId) ?? [];
    const action = tryAutoSelect(
      policies,
      currentGate.id,
      instance.context,
      instance.selections,
    );

    if (!action) return null;

    return this.selectBranch(instanceId, action.branchId, [
      {
        kind: "rule",
        source: "policy-engine",
        content: `정책 자동 선택: ${action.branchId}`,
        weight: 1.0,
      },
    ], { confidence: action.confidence });
  }

  /**
   * 자동 선택 가능한 모든 gate를 연속 처리한다.
   * 수동 결정이 필요한 gate에서 멈춘다.
   */
  autoAdvance(instanceId: string): FlowInstance {
    let result = this.autoSelect(instanceId);
    while (result && result.status === "active") {
      const next = this.autoSelect(instanceId);
      if (!next) break;
      result = next;
    }
    return this.getInstance(instanceId)!;
  }

  // ── 플로우 완료/포기 ──────────────────────────────────

  /**
   * 플로우를 명시적으로 완료한다.
   * 모든 gate를 거치지 않아도 강제 완료 가능.
   */
  completeFlow(instanceId: string, outcome?: string): FlowInstance {
    const instance = this.getInstanceOrThrow(instanceId);
    if (instance.status !== "active") {
      throw new Error(`플로우가 active 상태가 아니다: "${instance.status}"`);
    }
    const schema = this.getSchemaOrThrow(instance.schemaId);
    instance.outcome = outcome;
    this.completeFlowInternal(instance, schema);
    return toImmutable(instance);
  }

  /** 플로우를 포기한다. */
  abandonFlow(instanceId: string, reason?: string): FlowInstance {
    const instance = this.getInstanceOrThrow(instanceId);
    instance.status = "abandoned";
    instance.completedAt = new Date().toISOString();
    if (reason) {
      instance.context = { ...instance.context, abandonReason: reason };
    }
    return toImmutable(instance);
  }

  // ── 조회 ──────────────────────────────────────────────

  /** 플로우 인스턴스 목록 (필터 가능) */
  listInstances(filter?: {
    schemaId?: string;
    status?: FlowStatus;
  }): FlowInstance[] {
    let results = [...this.instances.values()];
    if (filter?.schemaId) {
      results = results.filter((i) => i.schemaId === filter.schemaId);
    }
    if (filter?.status) {
      results = results.filter((i) => i.status === filter.status);
    }
    return results.map(toImmutable);
  }

  // ── 내부 ──────────────────────────────────────────────

  private getInstanceOrThrow(instanceId: string): MutableFlowInstance {
    const inst = this.instances.get(instanceId);
    if (!inst) throw new Error(`인스턴스를 찾을 수 없다: "${instanceId}"`);
    return inst;
  }

  private getSchemaOrThrow(schemaId: string): FlowSchema {
    const schema = this.schemas.get(schemaId);
    if (!schema) throw new Error(`스키마를 찾을 수 없다: "${schemaId}"`);
    return schema;
  }

  private completeFlowInternal(
    instance: MutableFlowInstance,
    schema: FlowSchema,
  ): void {
    instance.status = "completed";
    instance.completedAt = new Date().toISOString();

    // 좌표 인코딩 시도 (모든 gate에 선택이 있어야 가능)
    const allGatesCovered = schema.gates.every((g) =>
      instance.selections.some((s) => s.gateId === g.id),
    );
    if (allGatesCovered) {
      try {
        // subFlow가 없는 단순 플로우만 자동 인코딩
        const hasSubFlow = schema.gates.some((g) => g.subFlowId);
        if (!hasSubFlow) {
          instance.coordinateAddress = encodeSelections(
            schema,
            instance.selections,
          );
        }
      } catch {
        // 인코딩 실패 시 좌표 없이 완료 (비정상 경로 등)
      }
    }

    try {
      const scopeMode = typeof instance.context.scopeMode === "string"
        ? instance.context.scopeMode
        : typeof instance.context.scope_mode === "string"
        ? instance.context.scope_mode
        : undefined;
      instance.addressContext = buildFlowCompletionContext(
        schema,
        toImmutable(instance),
        scopeMode,
      );
    } catch {
      // address_context 생성 실패는 완료를 막지 않는다.
    }

    this.instanceStore?.save(toImmutable(instance));
  }
}

export interface FlowEngineOptions {
  readonly instanceStore?: InstanceStore;
}

// ─── 내부 타입 + 유틸 ────────────────────────────────────

/** 변경 가능한 내부 인스턴스 표현 */
interface MutableFlowInstance {
  id: string;
  schemaId: string;
  schemaVersion: string;
  status: FlowStatus;
  context: Record<string, unknown>;
  selections: GateSelection[];
  outcome?: string;
  startedAt: string;
  completedAt?: string;
  coordinateAddress?: number;
  addressContext?: Record<string, string>;
}

/** 내부 인스턴스 → 불변 공개 인터페이스 */
function toImmutable(inst: MutableFlowInstance): FlowInstance {
  return {
    id: inst.id,
    schemaId: inst.schemaId,
    schemaVersion: inst.schemaVersion,
    status: inst.status,
    context: { ...inst.context },
    selections: [...inst.selections],
    outcome: inst.outcome,
    startedAt: inst.startedAt,
    completedAt: inst.completedAt,
    coordinateAddress: inst.coordinateAddress,
    addressContext: inst.addressContext ? { ...inst.addressContext } : undefined,
  };
}

/** 근거의 weight를 기반으로 confidence 산출 */
function computeConfidence(evidence: readonly Evidence[]): number {
  if (evidence.length === 0) return 0.5; // 근거 없으면 중간값

  const totalWeight = evidence.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight === 0) return 0.5;

  // weight 가중 평균 (weight 자체가 영향도이므로 그 평균이 신뢰도)
  return Math.min(1, totalWeight / evidence.length);
}
