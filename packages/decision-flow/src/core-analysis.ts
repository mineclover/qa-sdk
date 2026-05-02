/**
 * 코어 분석 — 의사결정 플로우의 구조적 분석
 *
 * 핵심 질문 3가지를 답한다:
 * 1. 어떤 gate가 코어인가? (구조적 영향도)
 * 2. 어떤 gate가 어떤 gate를 결정하는가? (인과 그래프)
 * 3. 특정 gate를 바꾸면 무엇이 무효화되는가? (영향 범위)
 */

import type {
  FlowInstance,
  FlowSchema,
  GateDependency,
  GateSelection,
  GateWeight,
} from "./types.js";

// ─── 코어 게이트 식별 ────────────────────────────────────

/** gate의 구조적 프로파일 */
export interface GateProfile {
  readonly gateId: string;
  readonly name: string;
  readonly weight: GateWeight;
  /** 이 gate가 직접 영향을 미치는 gate 수 */
  readonly directImpact: number;
  /** 이 gate가 전이적으로 영향을 미치는 gate 수 (cascade) */
  readonly transitiveImpact: number;
  /** 이 gate에 의존하는 gate 수 (역방향) */
  readonly dependents: number;
  /** 코어 점수: weight + impact + dependents 종합 */
  readonly coreScore: number;
}

/**
 * 플로우 스키마를 분석하여 각 gate의 구조적 프로파일을 산출한다.
 *
 * core gate를 식별하는 기준:
 * - 명시적 weight: "core" > "structural" > "tactical"
 * - 전이적 영향 범위(transitiveImpact)가 큰 gate
 * - 역방향 의존(dependents)이 없는 gate = 루트 결정
 */
export function analyzeGateStructure(schema: FlowSchema): GateProfile[] {
  const gates = schema.gates;
  const gateMap = new Map(gates.map((g) => [g.id, g]));

  // 정방향 인접 리스트 (gate → 영향받는 gates)
  const forwardEdges = new Map<string, string[]>();
  // 역방향 인접 리스트 (gate → 이 gate에 의존하는 gates)
  const reverseEdges = new Map<string, string[]>();

  for (const gate of gates) {
    forwardEdges.set(gate.id, []);
    reverseEdges.set(gate.id, []);
  }

  for (const gate of gates) {
    if (!gate.affects) continue;
    for (const dep of gate.affects) {
      if (gateMap.has(dep.gateId)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- initialized above for all gates
        forwardEdges.get(gate.id)!.push(dep.gateId);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- initialized above for all gates
        reverseEdges.get(dep.gateId)!.push(gate.id);
      }
    }
  }

  // 전이적 도달 가능성 (BFS)
  function transitiveReach(startId: string): Set<string> {
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loop guard ensures queue is non-empty
      const current = queue.shift()!;
      for (const next of forwardEdges.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return visited;
  }

  return gates.map((gate) => {
    const weight = gate.weight ?? "tactical";
    const directImpact = forwardEdges.get(gate.id)?.length ?? 0;
    const transitive = transitiveReach(gate.id);
    const transitiveImpact = transitive.size;
    const dependents = reverseEdges.get(gate.id)?.length ?? 0;

    // 코어 점수 산출
    const weightScore = weight === "core" ? 10 : weight === "structural" ? 5 : 1;
    const coreScore = weightScore + transitiveImpact * 3 + directImpact * 2 - dependents;

    return {
      gateId: gate.id,
      name: gate.name,
      weight,
      directImpact,
      transitiveImpact,
      dependents,
      coreScore,
    };
  }).toSorted((a, b) => b.coreScore - a.coreScore);
}

/** 코어 gate만 필터 (weight="core" 또는 coreScore 상위) */
export function identifyCoreGates(
  profiles: readonly GateProfile[],
  options?: { minScore?: number },
): GateProfile[] {
  const minScore = options?.minScore ?? 8;
  return profiles.filter((p) => p.weight === "core" || p.coreScore >= minScore);
}

// ─── 인과 그래프 ─────────────────────────────────────────

/** 인과 엣지 */
export interface CausalEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: GateDependency["kind"];
}

/** 플로우 스키마에서 인과 그래프를 추출한다 */
export function extractCausalGraph(schema: FlowSchema): {
  readonly edges: readonly CausalEdge[];
  readonly roots: readonly string[];  // 의존 없는 gate (루트 결정)
  readonly leaves: readonly string[]; // 누구에게도 영향 안 주는 gate
} {
  const edges: CausalEdge[] = [];
  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();

  for (const gate of schema.gates) {
    if (!gate.affects) continue;
    for (const dep of gate.affects) {
      edges.push({ from: gate.id, to: dep.gateId, kind: dep.kind });
      hasOutgoing.add(gate.id);
      hasIncoming.add(dep.gateId);
    }
  }

  const allIds = schema.gates.map((g) => g.id);
  const roots = allIds.filter((id) => !hasIncoming.has(id) && hasOutgoing.has(id));
  const leaves = allIds.filter((id) => !hasOutgoing.has(id));

  return { edges, roots, leaves };
}

// ─── 영향 범위 분석 ──────────────────────────────────────

/** 특정 gate를 변경했을 때의 영향 범위 */
export interface ImpactAnalysis {
  /** 변경 대상 gate */
  readonly changedGate: string;
  /** 직접 무효화되는 gate */
  readonly directlyInvalidated: readonly string[];
  /** 전이적으로 무효화되는 gate (cascade) */
  readonly transitivelyInvalidated: readonly string[];
  /** 영향받는 gate의 weight 분포 */
  readonly impactedWeights: Record<GateWeight, number>;
  /** 이 변경이 코어 gate를 무효화하는가? */
  readonly invalidatesCore: boolean;
}

/**
 * 특정 gate를 변경했을 때 무엇이 무효화되는지 분석한다.
 *
 * invalidates 엣지를 따라 전이적으로 추적.
 * constrains/enables 엣지는 직접 영향만 보고.
 */
export function analyzeImpact(
  schema: FlowSchema,
  changedGateId: string,
): ImpactAnalysis {
  const gateMap = new Map(schema.gates.map((g) => [g.id, g]));
  const gate = gateMap.get(changedGateId);
  if (!gate) throw new Error(`gate "${changedGateId}" not found`);

  // 직접 영향
  const directlyInvalidated = (gate.affects ?? [])
    .filter((d) => d.kind === "invalidates")
    .map((d) => d.gateId)
    .filter((id) => gateMap.has(id));

  // 전이적 추적 (invalidates 체인)
  const transitiveSet = new Set<string>();
  const queue = [...directlyInvalidated];
  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loop guard ensures queue is non-empty
    const current = queue.shift()!;
    if (transitiveSet.has(current)) continue;
    transitiveSet.add(current);
    const g = gateMap.get(current);
    if (g?.affects) {
      for (const dep of g.affects) {
        if (dep.kind === "invalidates" && !transitiveSet.has(dep.gateId)) {
          queue.push(dep.gateId);
        }
      }
    }
  }

  // constrains/enables는 직접 영향만
  const _constrainsOrEnables = (gate.affects ?? [])
    .filter((d) => d.kind !== "invalidates")
    .map((d) => d.gateId)
    .filter((id) => gateMap.has(id));

  const allInvalidated = [...new Set([...directlyInvalidated, ...transitiveSet])];

  // weight 분포
  const impactedWeights: Record<GateWeight, number> = { core: 0, structural: 0, tactical: 0 };
  for (const id of allInvalidated) {
    const w = gateMap.get(id)?.weight ?? "tactical";
    impactedWeights[w]++;
  }

  const invalidatesCore = allInvalidated.some((id) =>
    (gateMap.get(id)?.weight ?? "tactical") === "core",
  );

  return {
    changedGate: changedGateId,
    directlyInvalidated,
    transitivelyInvalidated: [...transitiveSet].filter((id) => !directlyInvalidated.includes(id)),
    impactedWeights,
    invalidatesCore,
  };
}

// ─── 인스턴스 리플레이 분석 ──────────────────────────────

/** 완료된 인스턴스에서 코어 결정 경로를 추출한다 */
export interface CoreDecisionTrace {
  /** 코어 gate에서의 선택만 추출 */
  readonly coreSelections: readonly GateSelection[];
  /** 코어 선택의 인과 체인 (A → B → C) */
  readonly causalChain: readonly string[];
  /** "이 플로우의 운명을 결정한 순간"들 */
  readonly pivotPoints: readonly PivotPoint[];
}

/** 운명을 결정한 순간 */
export interface PivotPoint {
  readonly gateId: string;
  readonly branchId: string;
  /** 이 선택이 배제한 다른 branch 수 */
  readonly excludedBranches: number;
  /** 이 선택으로 인해 무효화/활성화된 후속 gate 수 */
  readonly downstreamImpact: number;
  /** 왜 이것이 pivot인가 */
  readonly reason: string;
}

/**
 * 완료된 FlowInstance에서 코어 결정 추적을 수행한다.
 *
 * 코어 gate의 선택만 추출하고,
 * 각 코어 선택이 배제한 대안과 영향 범위를 기록한다.
 */
export function traceCorePath(
  schema: FlowSchema,
  instance: FlowInstance,
): CoreDecisionTrace {
  const gateMap = new Map(schema.gates.map((g) => [g.id, g]));
  const profiles = analyzeGateStructure(schema);
  const coreIds = new Set(identifyCoreGates(profiles).map((p) => p.gateId));

  const coreSelections = instance.selections.filter((s) => coreIds.has(s.gateId));

  // 인과 체인 구성
  const causalChain: string[] = [];
  for (const sel of coreSelections) {
    causalChain.push(`${sel.gateId}=${sel.branchId}`);
  }

  // pivot points
  const pivotPoints: PivotPoint[] = [];
  for (const sel of coreSelections) {
    const gate = gateMap.get(sel.gateId);
    if (!gate) continue;

    const totalBranches = gate.branches?.length ?? 0;
    const excludedBranches = Math.max(0, totalBranches - 1);

    const impact = analyzeImpact(schema, sel.gateId);
    const downstreamImpact =
      impact.directlyInvalidated.length + impact.transitivelyInvalidated.length;

    let reason: string;
    if (gate.weight === "core") {
      reason = `명시적 코어 gate — ${excludedBranches}개 대안 배제, ${downstreamImpact}개 후속 영향`;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- profiles derived from same schema, gate guaranteed to exist
      const profile = profiles.find((p) => p.gateId === sel.gateId)!;
      reason = `구조 점수 ${profile.coreScore} — 전이 영향 ${profile.transitiveImpact}개 gate`;
    }

    pivotPoints.push({
      gateId: sel.gateId,
      branchId: sel.branchId,
      excludedBranches,
      downstreamImpact,
      reason,
    });
  }

  return { coreSelections, causalChain, pivotPoints };
}
