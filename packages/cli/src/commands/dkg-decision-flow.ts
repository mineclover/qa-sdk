import {
  FlowEngine,
  SPRINT_FLOW_REGISTRY,
  analyzeImpact,
  getAnnotatedDesignFlow,
  traceCorePath,
} from "decision-flow";
import type {
  AddressContext,
  Evidence,
  FlowInstance,
  FlowSchema,
  GateSchema,
  GateWeight,
  ImpactAnalysis,
} from "decision-flow";

type GateDependencyKind = "constrains" | "enables" | "invalidates";

export interface DkgFlowBridgeStep {
  readonly gateId: string;
  readonly branchId: string;
}

export interface DkgFlowBridgeResult {
  readonly instance: FlowInstance;
  readonly currentGate: GateSchema | null;
  readonly appliedSteps: readonly DkgFlowBridgeStep[];
  readonly sequential: boolean;
}

export interface DkgFlowBridgeEvidenceInput {
  readonly rationale?: string;
  readonly scaffoldContext?: string;
  readonly alternatives?: readonly string[];
  readonly reversalConditions?: readonly string[];
  readonly confidence?: number;
}

export interface DkgCoreGateImpact {
  readonly gateId: string;
  readonly kind: GateDependencyKind;
  readonly weight: GateWeight;
}

export interface DkgCoreGateWarning {
  readonly gateId: string;
  readonly gateName: string;
  readonly branchId: string;
  readonly branchLabel: string;
  readonly weight: GateWeight;
  readonly impactedGates: readonly DkgCoreGateImpact[];
  readonly invalidation: ImpactAnalysis;
}

const FLOW_INSTANCE_META_PREFIX = "flow-instance:";

const FLOW_STEPS_BY_TYPE: Record<string, readonly DkgFlowBridgeStep[]> = {
  capacity: [
    { gateId: "axis-definition", branchId: "reuse-existing" },
  ],
  "new-axis": [
    { gateId: "axis-definition", branchId: "new-axis" },
  ],
  "new-prefix": [
    { gateId: "axis-definition", branchId: "reuse-existing" },
    { gateId: "prefix-design", branchId: "new-prefix" },
  ],
  merge: [
    { gateId: "axis-definition", branchId: "reuse-existing" },
    { gateId: "merge-split", branchId: "merge" },
  ],
  deprecate: [
    { gateId: "axis-definition", branchId: "reuse-existing" },
    { gateId: "merge-split", branchId: "keep-separate" },
  ],
};

const FLOW_JUMP_BY_TYPE: Record<string, string | undefined> = {
  capacity: "capacity-setting",
  "new-prefix": "prefix-design",
  merge: "merge-split",
  deprecate: "merge-split",
};

export function getDkgFlowBridgeSteps(type: string): readonly DkgFlowBridgeStep[] {
  return FLOW_STEPS_BY_TYPE[type] ?? [];
}

export function applyDkgFlowDecisionTypeJump(schema: FlowSchema, type: string): FlowSchema {
  const nextGateId = FLOW_JUMP_BY_TYPE[type];
  if (!nextGateId) {
    return schema;
  }

  return {
    ...schema,
    gates: schema.gates.map((gate) => {
      if (gate.id !== "axis-definition" || !gate.branches) {
        return gate;
      }

      return {
        ...gate,
        branches: gate.branches.map((branch) => {
          if (branch.id !== "reuse-existing") {
            return branch;
          }
          return {
            ...branch,
            nextGateId,
          };
        }),
      };
    }),
  };
}

export async function startDkgDecisionFlowBridge(input: {
  readonly type: string;
  readonly context: Record<string, unknown>;
  readonly decisionId?: string;
  readonly evidence?: DkgFlowBridgeEvidenceInput;
  readonly completeDefaults?: boolean;
}): Promise<DkgFlowBridgeResult> {
  const engine = new FlowEngine();
  const schema = applyDkgFlowDecisionTypeJump(getAnnotatedDesignFlow(), input.type);
  engine.registerSchema(schema);
  const context = input.decisionId
    ? { ...input.context, dkgDecisionId: input.decisionId }
    : { ...input.context };
  const started = engine.startFlow("coordinate-design", context);
  const appliedSteps = getDkgFlowBridgeSteps(input.type);

  for (const step of appliedSteps) {
    const currentGate = engine.getCurrentGate(started.id);
    if (!currentGate) {
      throw new Error(`자동 매핑 실패: "${step.gateId}" 이전에 플로우가 종료됨`);
    }
    if (currentGate.id !== step.gateId) {
      throw new Error(`자동 매핑 실패: 현재 gate=${currentGate.id}, 기대 gate=${step.gateId}`);
    }
    const evidence = buildDkgDecisionEvidence(currentGate, step.branchId, input.evidence);
    engine.selectBranch(started.id, step.branchId, evidence, { confidence: input.evidence?.confidence });
  }

  if (input.completeDefaults && appliedSteps.length > 0) {
    autoCompleteDkgDecisionFlow(engine, started.id, input);
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- startFlow()로 생성된 인스턴스 존재 보장
    instance: engine.getInstance(started.id)!,
    currentGate: engine.getCurrentGate(started.id),
    appliedSteps,
    sequential: appliedSteps.length === 0,
  };
}

function buildDkgDecisionEvidence(
  gate: GateSchema,
  branchId: string,
  input?: DkgFlowBridgeEvidenceInput,
): Evidence[] {
  if (!input) {
    return [];
  }

  const evidence: Evidence[] = [];

  if (input.rationale) {
    evidence.push({
      kind: "rule",
      source: "dkg-decide",
      content: input.rationale,
      weight: 0.95,
      metadata: { field: "rationale" },
    });
  }

  if (input.scaffoldContext) {
    evidence.push({
      kind: "rule",
      source: "dkg-decide:scaffold",
      content: input.scaffoldContext,
      weight: 0.75,
      metadata: { field: "context", autoGenerated: true },
    });
  }

  if (input.alternatives && input.alternatives.length > 0) {
    evidence.push({
      kind: "rule",
      source: "dkg-decide:scaffold",
      content: input.alternatives.join(" | "),
      weight: 0.7,
      metadata: { field: "alternatives", autoGenerated: true },
    });
  }

  if (input.reversalConditions && input.reversalConditions.length > 0) {
    evidence.push({
      kind: "rule",
      source: "dkg-decide:scaffold",
      content: input.reversalConditions.join(" | "),
      weight: 0.6,
      metadata: { field: "reversalConditions", autoGenerated: true },
    });
  }

  const unusedBranchDescriptions = gate.branches
    ?.filter((branch) => branch.id !== branchId)
    .map((branch) => branch.description ?? branch.label)
    .filter((description): description is string => description.length > 0);

  if (unusedBranchDescriptions && unusedBranchDescriptions.length > 0) {
    evidence.push({
      kind: "rule",
      source: "dkg-decide:alternatives",
      content: unusedBranchDescriptions.join(" | "),
      weight: 0.65,
      metadata: { field: "unused-branch-descriptions", gateId: gate.id },
    });
  }

  return evidence;
}

function autoCompleteDkgDecisionFlow(
  engine: FlowEngine,
  instanceId: string,
  input: {
    readonly type: string;
    readonly context: Record<string, unknown>;
    readonly evidence?: DkgFlowBridgeEvidenceInput;
  },
): void {
  while (true) {
    const currentGate = engine.getCurrentGate(instanceId);
    if (!currentGate) {
      return;
    }

    const branchId = resolveDkgDefaultBranch(currentGate, input.type, input.context);
    if (!branchId) {
      return;
    }

    const evidence = buildDkgDecisionEvidence(currentGate, branchId, input.evidence);
    engine.selectBranch(instanceId, branchId, evidence, { confidence: input.evidence?.confidence });
  }
}

function resolveDkgDefaultBranch(
  gate: GateSchema,
  type: string,
  context: Record<string, unknown>,
): string | null {
  const targetKind = typeof context.targetKind === "string" ? context.targetKind : undefined;

  switch (gate.id) {
    case "prefix-design":
      if (type === "new-prefix") return "new-prefix";
      if (type === "new-axis") {
        return targetKind === "prefix" ? "extend-existing" : "new-prefix";
      }
      return "extend-existing";
    case "capacity-setting":
      return "minimum";
    case "version-strategy":
      return "in-place";
    case "merge-split":
      if (type === "merge") return "merge";
      if (type === "deprecate") return "keep-separate";
      return "not-applicable";
    case "service-binding":
      return targetKind === "domain" ? "cross-cutting" : "single-owner";
    default:
      return null;
  }
}

export function flowInstanceMetaKey(instanceId: string): string {
  return `${FLOW_INSTANCE_META_PREFIX}${instanceId}`;
}

export function saveFlowInstanceMeta(
  store: { setMeta(key: string, value: string): void },
  instance: FlowInstance,
): void {
  store.setMeta(flowInstanceMetaKey(instance.id), JSON.stringify(instance));
}

export function buildDkgFlowAddressMetadata(
  instance: FlowInstance,
): { address_context: AddressContext } | undefined {
  if (!instance.addressContext || Object.keys(instance.addressContext).length === 0) {
    return undefined;
  }

  return {
    address_context: { ...instance.addressContext },
  };
}

export function loadFlowInstanceMeta(
  store: { getMeta(key: string): string | null },
  instanceId: string,
): FlowInstance | null {
  const raw = store.getMeta(flowInstanceMetaKey(instanceId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as FlowInstance;
  } catch {
    return null;
  }
}

export function resolveFlowSchema(schemaId: string): FlowSchema | null {
  if (schemaId === "coordinate-design") {
    return getAnnotatedDesignFlow();
  }
  return SPRINT_FLOW_REGISTRY.get(schemaId) ?? null;
}

export function collectDkgCoreGateWarnings(
  type: string,
  schema: FlowSchema = getAnnotatedDesignFlow(),
): readonly DkgCoreGateWarning[] {
  const gateMap = new Map(schema.gates.map((gate) => [gate.id, gate]));
  const warnings: DkgCoreGateWarning[] = [];

  for (const step of getDkgFlowBridgeSteps(type)) {
    const gate = gateMap.get(step.gateId);
    if (!gate || (gate.weight ?? "tactical") !== "core") {
      continue;
    }

    const branch = gate.branches?.find((candidate) => candidate.id === step.branchId);
    const impactedGates = (gate.affects ?? [])
      .filter((dependency) => gateMap.has(dependency.gateId))
      .map((dependency) => ({
        gateId: dependency.gateId,
        kind: dependency.kind,
        weight: gateMap.get(dependency.gateId)?.weight ?? "tactical",
      }));

    warnings.push({
      gateId: gate.id,
      gateName: gate.name,
      branchId: step.branchId,
      branchLabel: branch?.label ?? step.branchId,
      weight: gate.weight ?? "tactical",
      impactedGates,
      invalidation: analyzeImpact(schema, gate.id),
    });
  }

  return warnings;
}

export function formatDkgCoreGateWarnings(
  warnings: readonly DkgCoreGateWarning[],
): string[] {
  if (warnings.length === 0) {
    return [];
  }

  const lines = ["\n══ 코어 gate 영향 경고 ══"];
  for (const warning of warnings) {
    lines.push(`  ★ ${warning.gateId} (${warning.gateName}) ← ${warning.branchId} (${warning.branchLabel})`);

    if (warning.impactedGates.length === 0) {
      lines.push("    영향받는 gate: 없음");
    } else {
      lines.push("    영향받는 gate:");
      for (const impacted of warning.impactedGates) {
        lines.push(`      - ${impacted.gateId} [${impacted.kind}, ${impacted.weight}]`);
      }
    }

    const directCascade = warning.invalidation.directlyInvalidated.join(", ") || "없음";
    const transitiveCascade = warning.invalidation.transitivelyInvalidated.join(", ") || "없음";
    lines.push(`    무효화 cascade: direct=${directCascade}; transitive=${transitiveCascade}`);

    if (warning.invalidation.invalidatesCore) {
      lines.push("    ⚠ 코어 gate 무효화 — 전체 재설계 필요");
    }
  }

  return lines;
}

export function formatFlowInstanceCoreTrace(instance: FlowInstance): string[] {
  const lines = [
    `    instance: ${instance.id}`,
    `    schema: ${instance.schemaId} (${instance.schemaVersion})`,
  ];
  const dkgDecisionId = typeof instance.context.dkgDecisionId === "string"
    ? instance.context.dkgDecisionId
    : undefined;
  if (dkgDecisionId) {
    lines.push(`    dkgDecisionId: ${dkgDecisionId}`);
  }

  const schema = resolveFlowSchema(instance.schemaId);
  if (!schema) {
    lines.push("    스키마를 해석할 수 없어 코어 추적을 생략함");
    return lines;
  }

  const trace = traceCorePath(schema, instance);
  if (trace.pivotPoints.length === 0) {
    lines.push("    코어 결정 없음 (모든 gate가 tactical)");
    return lines;
  }

  lines.push("    인과 체인:");
  lines.push(`      ${trace.causalChain.join(" → ")}`);
  lines.push("    Pivot Points:");
  for (const pivot of trace.pivotPoints) {
    lines.push(`      ★ ${pivot.gateId} = ${pivot.branchId}`);
    lines.push(`        배제된 대안: ${pivot.excludedBranches}개`);
    lines.push(`        후속 영향: ${pivot.downstreamImpact}개 gate`);
    lines.push(`        ${pivot.reason}`);
  }

  return lines;
}
