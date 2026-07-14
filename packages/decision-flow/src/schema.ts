// @def.boundary df-model-group
/**
 * FlowSchema 빌더 + 검증
 */

import type {
  CognitivePhase,
  EvidenceKind,
  FlowSchema,
  GateDependency,
  GateSchema,
  GateWeight,
  OutcomeSchema,
} from './types.js';

// ─── 검증 ────────────────────────────────────────────────

export interface ValidationIssue {
  readonly level: 'error' | 'warning';
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/**
 * FlowSchema의 구조적 유효성을 검증한다.
 *
 * 검증 항목:
 * - gate ID 유일성
 * - branch ID 유일성 (gate 내)
 * - nextGateId가 실제 gate를 참조하는지
 * - subFlowId가 있으면 branches는 없어야 함
 * - 최소 1개 gate 존재
 * - terminal branch 이후 gate가 있으면 경고
 */
export function validateFlowSchema(schema: FlowSchema): ValidationResult {
  const issues: ValidationIssue[] = [];
  const gateIds = new Set<string>();

  if (schema.gates.length === 0) {
    issues.push({ level: 'error', path: 'gates', message: '최소 1개의 gate가 필요하다' });
  }

  for (let gi = 0; gi < schema.gates.length; gi++) {
    const gate = schema.gates[gi];
    const gPath = `gates[${gi}]`;

    // gate ID 중복 검사
    if (gateIds.has(gate.id)) {
      issues.push({ level: 'error', path: `${gPath}.id`, message: `gate ID 중복: "${gate.id}"` });
    }
    gateIds.add(gate.id);

    // subFlowId와 branches 상호 배타
    if (gate.subFlowId && gate.branches && gate.branches.length > 0) {
      issues.push({
        level: 'error',
        path: gPath,
        message: 'subFlowId와 branches는 동시에 정의할 수 없다',
      });
    }

    // subFlowId도 branches도 없는 gate
    if (!gate.subFlowId && (!gate.branches || gate.branches.length === 0)) {
      issues.push({
        level: 'error',
        path: gPath,
        message: 'branches 또는 subFlowId 중 하나는 필수',
      });
    }

    // branch ID 중복 검사
    if (gate.branches) {
      const branchIds = new Set<string>();
      for (let bi = 0; bi < gate.branches.length; bi++) {
        const branch = gate.branches[bi];
        if (branchIds.has(branch.id)) {
          issues.push({
            level: 'error',
            path: `${gPath}.branches[${bi}].id`,
            message: `branch ID 중복: "${branch.id}"`,
          });
        }
        branchIds.add(branch.id);
      }
    }
  }

  // nextGateId 참조 검증 (2차 패스 — gateIds 수집 후)
  for (let gi = 0; gi < schema.gates.length; gi++) {
    const gate = schema.gates[gi];
    if (!gate.branches) continue;
    for (let bi = 0; bi < gate.branches.length; bi++) {
      const branch = gate.branches[bi];
      if (branch.nextGateId && !gateIds.has(branch.nextGateId)) {
        issues.push({
          level: 'error',
          path: `gates[${gi}].branches[${bi}].nextGateId`,
          message: `참조 대상 gate가 없다: "${branch.nextGateId}"`,
        });
      }
      // terminal branch 이후 gate가 있으면 경고
      if (branch.terminal && gi < schema.gates.length - 1) {
        issues.push({
          level: 'warning',
          path: `gates[${gi}].branches[${bi}]`,
          message: 'terminal branch 뒤에 추가 gate가 존재한다 — 해당 gate는 건너뛸 수 있음',
        });
      }
    }
  }

  return { valid: issues.every((i) => i.level !== 'error'), issues };
}

// ─── 빌더 ────────────────────────────────────────────────

interface BranchInput {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly nextGateId?: string;
  readonly terminal?: boolean;
}

/**
 * FlowSchema를 플루언트 API로 조립한다.
 *
 * @example
 * ```ts
 * const schema = new FlowSchemaBuilder("feature-approval", "기능 승인")
 *   .description("기능 개발 승인 의사결정 플로우")
 *   .gate("risk", "위험도 평가", "perceive", [
 *     { id: "low", label: "낮음" },
 *     { id: "medium", label: "보통" },
 *     { id: "high", label: "높음" },
 *     { id: "critical", label: "치명적" },
 *   ])
 *   .subFlowGate("planning", "상세 계획", "plan", "detailed-planning")
 *   .gate("approval", "승인 레벨", "decide", [
 *     { id: "auto", label: "자동 승인" },
 *     { id: "lead", label: "팀 리드" },
 *     { id: "director", label: "디렉터" },
 *     { id: "vp", label: "VP" },
 *   ])
 *   .outcome("approved", "승인됨")
 *   .outcome("rejected", "반려됨")
 *   .build();
 * ```
 */
export class FlowSchemaBuilder {
  private readonly _id: string;
  private readonly _name: string;
  private _description = '';
  private _version = 'v1';
  private readonly _gates: GateSchema[] = [];
  private readonly _outcomes: OutcomeSchema[] = [];

  constructor(id: string, name: string) {
    this._id = id;
    this._name = name;
  }

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  version(v: string): this {
    this._version = v;
    return this;
  }

  /** 일반 gate 추가 (branches 직접 정의) */
  gate(
    id: string,
    name: string,
    phase: CognitivePhase,
    branches: readonly BranchInput[],
    options?: {
      weight?: GateWeight;
      affects?: readonly GateDependency[];
      mentalModels?: readonly string[];
      requiredEvidence?: readonly EvidenceKind[];
      optional?: boolean;
      timeoutMs?: number;
    },
  ): this {
    this._gates.push({
      id,
      name,
      phase,
      branches: branches.map((b) => ({
        id: b.id,
        label: b.label,
        description: b.description,
        nextGateId: b.nextGateId,
        terminal: b.terminal,
      })),
      weight: options?.weight,
      affects: options?.affects,
      mentalModels: options?.mentalModels,
      requiredEvidence: options?.requiredEvidence,
      optional: options?.optional,
      timeoutMs: options?.timeoutMs,
    });
    return this;
  }

  /** 하위 플로우를 참조하는 gate 추가 */
  subFlowGate(
    id: string,
    name: string,
    phase: CognitivePhase,
    subFlowId: string,
    options?: { optional?: boolean; timeoutMs?: number },
  ): this {
    this._gates.push({
      id,
      name,
      phase,
      subFlowId,
      optional: options?.optional,
      timeoutMs: options?.timeoutMs,
    });
    return this;
  }

  /** 결과 유형 추가 */
  outcome(id: string, label: string, description?: string): this {
    this._outcomes.push({ id, label, description });
    return this;
  }

  /** FlowSchema 생성 + 검증 */
  build(): FlowSchema {
    const schema: FlowSchema = {
      id: this._id,
      name: this._name,
      description: this._description,
      version: this._version,
      gates: [...this._gates],
      outcomes: this._outcomes.length > 0 ? [...this._outcomes] : undefined,
    };
    const result = validateFlowSchema(schema);
    if (!result.valid) {
      const errors = result.issues.filter((i) => i.level === 'error');
      throw new Error(
        `FlowSchema "${this._id}" 검증 실패:\n${errors.map((e) => `  - [${e.path}] ${e.message}`).join('\n')}`,
      );
    }
    return schema;
  }
}
