import type {
  CognitivePhase,
  Evidence,
  FlowInstance,
  FlowSchema,
  GateSelection,
  GateWeight,
} from "./types.js";
import type { InstanceStore } from "./instance-store.js";

export type GateDiffStatus = "match" | "diverge";
export type GateDiffEmphasis = "standard" | "core";

export interface EvidenceDiff {
  readonly hasDifference: boolean;
  readonly shared: readonly Evidence[];
  readonly onlyInA: readonly Evidence[];
  readonly onlyInB: readonly Evidence[];
  readonly totalWeightA: number;
  readonly totalWeightB: number;
  readonly weightDelta: number;
  readonly confidenceA?: number;
  readonly confidenceB?: number;
  readonly kindHistogramA: Readonly<Record<string, number>>;
  readonly kindHistogramB: Readonly<Record<string, number>>;
}

export interface GateDiff {
  readonly gateId: string;
  readonly gateName?: string;
  readonly phase?: CognitivePhase;
  readonly weight: GateWeight;
  readonly emphasis: GateDiffEmphasis;
  readonly status: GateDiffStatus;
  readonly branchA?: string;
  readonly branchB?: string;
  readonly selectionA?: GateSelection;
  readonly selectionB?: GateSelection;
  readonly evidenceDiff: EvidenceDiff;
}

export interface InstancePairDiff {
  readonly schemaId: string;
  readonly schemaVersionA: string;
  readonly schemaVersionB: string;
  readonly gateDiffs: readonly GateDiff[];
  readonly divergencePoint?: GateDiff;
  readonly divergedGateIds: readonly string[];
  readonly coreDivergences: readonly GateDiff[];
  readonly matchCount: number;
  readonly divergenceCount: number;
}

export interface BranchDistribution {
  readonly branchId: string;
  readonly count: number;
  readonly ratio: number;
  readonly averageConfidence: number;
  readonly isDominant: boolean;
}

export interface DominantBranchHint {
  readonly branchId: string;
  readonly count: number;
  readonly ratio: number;
  readonly averageConfidence: number;
  readonly hint: string;
}

export interface EvidenceKindBranchCorrelation {
  readonly branchId: string;
  readonly count: number;
  readonly ratio: number;
  readonly averageConfidence: number;
}

export interface EvidenceKindCorrelation {
  readonly evidenceKind: string;
  readonly selectionCount: number;
  readonly selectionRatio: number;
  readonly branches: readonly EvidenceKindBranchCorrelation[];
  readonly dominantBranchId?: string;
}

export interface GateDistribution {
  readonly schemaId: string;
  readonly gateId: string;
  readonly totalSelections: number;
  readonly branches: readonly BranchDistribution[];
  readonly dominantBranch?: DominantBranchHint;
  readonly evidenceKindCorrelations: readonly EvidenceKindCorrelation[];
}

export interface ComparisonTimeRange {
  readonly from?: string;
  readonly to?: string;
}

export interface TimeRangeComparisonOptions {
  readonly schema?: FlowSchema;
  readonly coreOnly?: boolean;
}

export interface ComparedRangeSummary extends ComparisonTimeRange {
  readonly instanceCount: number;
}

export interface GateBranchShift {
  readonly branchId: string;
  readonly countA: number;
  readonly countB: number;
  readonly ratioA: number;
  readonly ratioB: number;
  readonly deltaRatio: number;
  readonly shiftPercentage: number;
}

export interface GateDistributionShift {
  readonly gateId: string;
  readonly gateName?: string;
  readonly phase?: CognitivePhase;
  readonly weight: GateWeight;
  readonly totalSelectionsA: number;
  readonly totalSelectionsB: number;
  readonly totalShiftPercentage: number;
  readonly dominantBranchA?: string;
  readonly dominantBranchB?: string;
  readonly branches: readonly GateBranchShift[];
}

export interface ComparedPathSegment {
  readonly gateId: string;
  readonly branchId: string;
}

export interface TimeRangePathChange {
  readonly signature: string;
  readonly path: readonly ComparedPathSegment[];
  readonly countA: number;
  readonly countB: number;
}

export interface TimeRangeComparison {
  readonly schemaId: string;
  readonly rangeA: ComparedRangeSummary;
  readonly rangeB: ComparedRangeSummary;
  readonly coreOnly: boolean;
  readonly comparedGateIds: readonly string[];
  readonly coreGateIds: readonly string[];
  readonly gateShifts: readonly GateDistributionShift[];
  readonly emergedPaths: readonly TimeRangePathChange[];
  readonly disappearedPaths: readonly TimeRangePathChange[];
}

export interface ComparisonReportInput {
  readonly pairwiseDiff?: InstancePairDiff;
  readonly distributions?: readonly GateDistribution[];
  readonly temporalShifts?: readonly TimeRangeComparison[];
}

export type DifferenceReasonType =
  | "evidence-imbalance"
  | "exclusive-evidence"
  | "confidence-gap"
  | "missing-selection";

export interface DifferenceReasoning {
  readonly gateId: string;
  readonly gateName?: string;
  readonly phase?: CognitivePhase;
  readonly emphasis: GateDiffEmphasis;
  readonly branchA?: string;
  readonly branchB?: string;
  readonly reasonType: DifferenceReasonType;
  readonly summary: string;
  readonly evidenceSummary: {
    readonly sharedKinds: readonly string[];
    readonly uniqueKindsA: readonly string[];
    readonly uniqueKindsB: readonly string[];
    readonly uniqueWeightA: number;
    readonly uniqueWeightB: number;
    readonly confidenceA?: number;
    readonly confidenceB?: number;
  };
}

export interface DistributionInsight {
  readonly gateId: string;
  readonly dominantBranchId?: string;
  readonly summary: string;
  readonly sampleSize: number;
}

export interface TemporalShiftInsight {
  readonly gateId: string;
  readonly gateName?: string;
  readonly summary: string;
  readonly totalShiftPercentage: number;
  readonly dominantBranchA?: string;
  readonly dominantBranchB?: string;
}

export interface ComparisonReportSummary {
  readonly divergenceCount: number;
  readonly dominantDistributionCount: number;
  readonly temporalShiftCount: number;
  readonly highlights: readonly string[];
}

export interface ComparisonReport {
  readonly schemaId: string;
  readonly pairwiseDiff?: InstancePairDiff;
  readonly distributions: readonly GateDistribution[];
  readonly temporalShifts: readonly TimeRangeComparison[];
  readonly whyDifferent: readonly DifferenceReasoning[];
  readonly distributionInsights: readonly DistributionInsight[];
  readonly temporalInsights: readonly TemporalShiftInsight[];
  readonly summary: ComparisonReportSummary;
}

interface GateDescriptor {
  readonly gateId: string;
  readonly gateName?: string;
  readonly phase?: CognitivePhase;
  readonly weight: GateWeight;
}

/**
 * 동일 스키마의 두 인스턴스를 gate 단위로 비교한다.
 *
 * schema를 넘기면 gate 순서/이름/weight를 정확히 반영하고,
 * 생략하면 두 인스턴스의 선택 순서를 합쳐 비교한다.
 */
export function diffInstances(
  a: FlowInstance,
  b: FlowInstance,
  schema?: FlowSchema,
): InstancePairDiff {
  assertComparableInstances(a, b, schema);

  const selectedGateIds = new Set<string>([
    ...a.selections.map((selection) => selection.gateId),
    ...b.selections.map((selection) => selection.gateId),
  ]);
  const gateDescriptors = resolveGateDescriptors(a, b, schema)
    .filter((descriptor) => selectedGateIds.has(descriptor.gateId));
  const selectionMapA = buildSelectionMap(a.selections);
  const selectionMapB = buildSelectionMap(b.selections);

  const gateDiffs = gateDescriptors.map((descriptor) =>
    buildGateDiff(descriptor, selectionMapA.get(descriptor.gateId), selectionMapB.get(descriptor.gateId)));
  const divergencePoint = gateDiffs.find((gateDiff) => gateDiff.status === "diverge");
  const coreDivergences = gateDiffs.filter((gateDiff) =>
    gateDiff.status === "diverge" && gateDiff.weight === "core",
  );

  return {
    schemaId: a.schemaId,
    schemaVersionA: a.schemaVersion,
    schemaVersionB: b.schemaVersion,
    gateDiffs,
    divergencePoint,
    divergedGateIds: gateDiffs
      .filter((gateDiff) => gateDiff.status === "diverge")
      .map((gateDiff) => gateDiff.gateId),
    coreDivergences,
    matchCount: gateDiffs.filter((gateDiff) => gateDiff.status === "match").length,
    divergenceCount: gateDiffs.filter((gateDiff) => gateDiff.status === "diverge").length,
  };
}

/**
 * 저장된 이력에서 특정 gate의 branch 선택 분포를 계산한다.
 *
 * 완료된 인스턴스만 집계하며, branch별 count/ratio/평균 confidence와
 * evidence kind가 어떤 선택과 함께 나타나는지를 selection 단위로 분석한다.
 */
export function gateDistribution(
  store: InstanceStore,
  schemaId: string,
  gateId: string,
): GateDistribution {
  const instances = store.findBySchema(schemaId)
    .filter((instance) => instance.status === "completed");
  const selections = instances
    .map((instance) => findSelection(instance, gateId))
    .filter((selection): selection is GateSelection => selection !== undefined);
  const totalSelections = selections.length;
  const branchBuckets = new Map<string, GateSelection[]>();
  const evidenceBuckets = new Map<string, Map<string, GateSelection[]>>();

  for (const selection of selections) {
    const branchSelections = branchBuckets.get(selection.branchId) ?? [];
    branchSelections.push(selection);
    branchBuckets.set(selection.branchId, branchSelections);

    for (const evidenceKind of collectEvidenceKinds(selection)) {
      const branchMap = evidenceBuckets.get(evidenceKind) ?? new Map<string, GateSelection[]>();
      const correlatedSelections = branchMap.get(selection.branchId) ?? [];
      correlatedSelections.push(selection);
      branchMap.set(selection.branchId, correlatedSelections);
      evidenceBuckets.set(evidenceKind, branchMap);
    }
  }

  const branches = [...branchBuckets.entries()]
    .map(([branchId, branchSelections]) => toBranchDistribution(branchId, branchSelections, totalSelections))
    .sort((a, b) => b.count - a.count || a.branchId.localeCompare(b.branchId));
  const dominantBranch = branches.find((branch) => branch.isDominant);

  return {
    schemaId,
    gateId,
    totalSelections,
    branches,
    dominantBranch: dominantBranch
      ? {
          branchId: dominantBranch.branchId,
          count: dominantBranch.count,
          ratio: dominantBranch.ratio,
          averageConfidence: dominantBranch.averageConfidence,
          hint: `${gateId} gate에서 "${dominantBranch.branchId}" branch가 ${Math.round(dominantBranch.ratio * 100)}%로 지배적이다.`,
        }
      : undefined,
    evidenceKindCorrelations: [...evidenceBuckets.entries()]
      .map(([evidenceKind, branchMap]) =>
        toEvidenceKindCorrelation(evidenceKind, branchMap, totalSelections))
      .sort((a, b) =>
        b.selectionCount - a.selectionCount
        || a.evidenceKind.localeCompare(b.evidenceKind),
      ),
  };
}

/**
 * 두 시간 범위의 결정 패턴 변화를 gate 분포와 경로 기준으로 비교한다.
 *
 * 각 범위는 완료 인스턴스 2건 이상이 필요하며,
 * coreOnly 옵션을 쓰면 schema에 정의된 core gate만 비교한다.
 */
export function compareTimeRanges(
  store: InstanceStore,
  schemaId: string,
  rangeA: ComparisonTimeRange,
  rangeB: ComparisonTimeRange,
  options: TimeRangeComparisonOptions = {},
): TimeRangeComparison {
  const instancesA = resolveCompletedRange(store, schemaId, rangeA);
  const instancesB = resolveCompletedRange(store, schemaId, rangeB);
  assertSufficientSampleSize(instancesA, "rangeA");
  assertSufficientSampleSize(instancesB, "rangeB");

  if (options.coreOnly && !options.schema) {
    throw new Error("coreOnly 비교에는 schema 옵션이 필요하다");
  }

  const selectedGateIds = new Set<string>([
    ...collectSelectedGateIds(instancesA),
    ...collectSelectedGateIds(instancesB),
  ]);
  const allDescriptors = resolveGateDescriptorsFromInstances(instancesA, instancesB, options.schema)
    .filter((descriptor) => selectedGateIds.has(descriptor.gateId));
  const comparedDescriptors = options.coreOnly
    ? allDescriptors.filter((descriptor) => descriptor.weight === "core")
    : allDescriptors;
  const coreGateIds = allDescriptors
    .filter((descriptor) => descriptor.weight === "core")
    .map((descriptor) => descriptor.gateId);
  const pathBucketsA = buildPathBuckets(instancesA, comparedDescriptors);
  const pathBucketsB = buildPathBuckets(instancesB, comparedDescriptors);

  return {
    schemaId,
    rangeA: {
      ...rangeA,
      instanceCount: instancesA.length,
    },
    rangeB: {
      ...rangeB,
      instanceCount: instancesB.length,
    },
    coreOnly: options.coreOnly ?? false,
    comparedGateIds: comparedDescriptors.map((descriptor) => descriptor.gateId),
    coreGateIds,
    gateShifts: comparedDescriptors.map((descriptor) =>
      buildGateDistributionShift(descriptor, instancesA, instancesB)),
    emergedPaths: diffPathBuckets(pathBucketsA, pathBucketsB, "emerged"),
    disappearedPaths: diffPathBuckets(pathBucketsA, pathBucketsB, "disappeared"),
  };
}

/**
 * 개별 비교 결과를 JSON 직렬화 가능한 단일 보고서 구조로 합친다.
 *
 * pairwise diff에서 evidence 차이를 읽어 "왜 다른가" 추론을 만들고,
 * gate 분포/시간 변화 결과를 사람이 바로 훑을 수 있는 insight로 요약한다.
 */
export function createComparisonReport(
  input: ComparisonReportInput,
): ComparisonReport {
  const distributions = [...(input.distributions ?? [])];
  const temporalShifts = [...(input.temporalShifts ?? [])];
  const schemaId = resolveReportSchemaId(input.pairwiseDiff, distributions, temporalShifts);
  const whyDifferent = input.pairwiseDiff
    ? buildDifferenceReasoning(input.pairwiseDiff)
    : [];
  const distributionInsights = distributions.map(toDistributionInsight);
  const temporalInsights = temporalShifts.flatMap((comparison) =>
    comparison.gateShifts
      .filter((gateShift) => gateShift.totalShiftPercentage > 0)
      .map(toTemporalShiftInsight));
  const highlights = [
    ...whyDifferent.map((reasoning) => reasoning.summary),
    ...distributionInsights.map((insight) => insight.summary),
    ...temporalInsights.map((insight) => insight.summary),
  ];

  return {
    schemaId,
    pairwiseDiff: input.pairwiseDiff,
    distributions,
    temporalShifts,
    whyDifferent,
    distributionInsights,
    temporalInsights,
    summary: {
      divergenceCount: input.pairwiseDiff?.divergenceCount ?? 0,
      dominantDistributionCount: distributions
        .filter((distribution) => distribution.dominantBranch !== undefined).length,
      temporalShiftCount: temporalInsights.length,
      highlights,
    },
  };
}

function assertComparableInstances(
  a: FlowInstance,
  b: FlowInstance,
  schema: FlowSchema | undefined,
): void {
  if (a.schemaId !== b.schemaId) {
    throw new Error(
      `서로 다른 스키마 인스턴스는 비교할 수 없다: "${a.schemaId}" vs "${b.schemaId}"`,
    );
  }

  if (schema && schema.id !== a.schemaId) {
    throw new Error(
      `비교 대상과 schema ID가 일치하지 않는다: "${schema.id}" vs "${a.schemaId}"`,
    );
  }
}

function resolveReportSchemaId(
  pairwiseDiff: InstancePairDiff | undefined,
  distributions: readonly GateDistribution[],
  temporalShifts: readonly TimeRangeComparison[],
): string {
  const schemaIds = new Set<string>([
    ...(pairwiseDiff ? [pairwiseDiff.schemaId] : []),
    ...distributions.map((distribution) => distribution.schemaId),
    ...temporalShifts.map((comparison) => comparison.schemaId),
  ]);

  if (schemaIds.size === 0) {
    throw new Error("ComparisonReport를 생성하려면 최소 한 개 이상의 비교 결과가 필요하다");
  }

  if (schemaIds.size > 1) {
    throw new Error(`ComparisonReport의 schemaId가 일치해야 한다: ${[...schemaIds].join(", ")}`);
  }

  return [...schemaIds][0]!;
}

function buildDifferenceReasoning(
  pairwiseDiff: InstancePairDiff,
): DifferenceReasoning[] {
  return pairwiseDiff.gateDiffs
    .filter((gateDiff) => gateDiff.status === "diverge")
    .map((gateDiff) => {
      const sharedKinds = collectKinds(gateDiff.evidenceDiff.shared);
      const uniqueKindsA = collectKinds(gateDiff.evidenceDiff.onlyInA);
      const uniqueKindsB = collectKinds(gateDiff.evidenceDiff.onlyInB);
      const uniqueWeightA = totalEvidenceWeight(gateDiff.evidenceDiff.onlyInA);
      const uniqueWeightB = totalEvidenceWeight(gateDiff.evidenceDiff.onlyInB);
      const reasonType = classifyDifferenceReason(gateDiff, uniqueWeightA, uniqueWeightB, sharedKinds.length);

      return {
        gateId: gateDiff.gateId,
        gateName: gateDiff.gateName,
        phase: gateDiff.phase,
        emphasis: gateDiff.emphasis,
        branchA: gateDiff.branchA,
        branchB: gateDiff.branchB,
        reasonType,
        summary: summarizeDifferenceReason(
          gateDiff,
          reasonType,
          uniqueKindsA,
          uniqueKindsB,
          uniqueWeightA,
          uniqueWeightB,
        ),
        evidenceSummary: {
          sharedKinds,
          uniqueKindsA,
          uniqueKindsB,
          uniqueWeightA,
          uniqueWeightB,
          confidenceA: gateDiff.evidenceDiff.confidenceA,
          confidenceB: gateDiff.evidenceDiff.confidenceB,
        },
      };
    });
}

function classifyDifferenceReason(
  gateDiff: GateDiff,
  uniqueWeightA: number,
  uniqueWeightB: number,
  sharedKindCount: number,
): DifferenceReasonType {
  if (!gateDiff.branchA || !gateDiff.branchB) {
    return "missing-selection";
  }

  if (uniqueWeightA > 0 || uniqueWeightB > 0) {
    return sharedKindCount === 0 ? "exclusive-evidence" : "evidence-imbalance";
  }

  return "confidence-gap";
}

function summarizeDifferenceReason(
  gateDiff: GateDiff,
  reasonType: DifferenceReasonType,
  uniqueKindsA: readonly string[],
  uniqueKindsB: readonly string[],
  uniqueWeightA: number,
  uniqueWeightB: number,
): string {
  const gateLabel = gateDiff.gateName ?? gateDiff.gateId;
  const branchA = gateDiff.branchA ? `"${gateDiff.branchA}"` : "선택 없음";
  const branchB = gateDiff.branchB ? `"${gateDiff.branchB}"` : "선택 없음";

  if (reasonType === "missing-selection") {
    return `${gateLabel} gate는 A=${branchA}, B=${branchB}로 갈렸고 한쪽은 해당 gate를 거치지 않았다.`;
  }

  if (reasonType === "confidence-gap") {
    return `${gateLabel} gate는 같은 근거 패턴에서도 A confidence ${formatConfidence(gateDiff.evidenceDiff.confidenceA)}, B confidence ${formatConfidence(gateDiff.evidenceDiff.confidenceB)}로 판단 강도가 갈렸다.`;
  }

  if (reasonType === "exclusive-evidence") {
    return `${gateLabel} gate는 A=${branchA}, B=${branchB}로 갈렸고 A는 ${formatKinds(uniqueKindsA)} 근거(총 ${uniqueWeightA}), B는 ${formatKinds(uniqueKindsB)} 근거(총 ${uniqueWeightB})를 각각 별도로 사용했다.`;
  }

  return `${gateLabel} gate는 A=${branchA}, B=${branchB}로 갈렸고 A는 ${formatKinds(uniqueKindsA)} 근거(총 ${uniqueWeightA}), B는 ${formatKinds(uniqueKindsB)} 근거(총 ${uniqueWeightB})에 더 크게 끌렸다.`;
}

function toDistributionInsight(
  distribution: GateDistribution,
): DistributionInsight {
  if (distribution.dominantBranch) {
    return {
      gateId: distribution.gateId,
      dominantBranchId: distribution.dominantBranch.branchId,
      sampleSize: distribution.totalSelections,
      summary: `${distribution.gateId} gate는 "${distribution.dominantBranch.branchId}"가 ${Math.round(distribution.dominantBranch.ratio * 100)}%로 지배적이다.`,
    };
  }

  const topBranch = distribution.branches[0];
  if (!topBranch) {
    return {
      gateId: distribution.gateId,
      sampleSize: distribution.totalSelections,
      summary: `${distribution.gateId} gate는 완료된 선택 표본이 없어 분포 해석을 만들 수 없다.`,
    };
  }

  return {
    gateId: distribution.gateId,
    dominantBranchId: topBranch.branchId,
    sampleSize: distribution.totalSelections,
    summary: `${distribution.gateId} gate는 "${topBranch.branchId}"가 가장 많지만 지배적이라고 보기엔 표본이 갈려 있다.`,
  };
}

function toTemporalShiftInsight(
  gateShift: GateDistributionShift,
): TemporalShiftInsight {
  const strongestBranch = gateShift.branches[0];
  const gateLabel = gateShift.gateName ?? gateShift.gateId;
  const dominantBefore = gateShift.dominantBranchA ? `"${gateShift.dominantBranchA}"` : "없음";
  const dominantAfter = gateShift.dominantBranchB ? `"${gateShift.dominantBranchB}"` : "없음";
  const branchHint = strongestBranch
    ? `가장 큰 이동은 "${strongestBranch.branchId}" (${strongestBranch.shiftPercentage}%)였다.`
    : "분기 이동 세부 내역은 없다.";

  return {
    gateId: gateShift.gateId,
    gateName: gateShift.gateName,
    totalShiftPercentage: gateShift.totalShiftPercentage,
    dominantBranchA: gateShift.dominantBranchA,
    dominantBranchB: gateShift.dominantBranchB,
    summary: `${gateLabel} gate는 기간 A의 우세 branch ${dominantBefore}에서 기간 B의 우세 branch ${dominantAfter}로 이동했고 총 변화율은 ${gateShift.totalShiftPercentage}%다. ${branchHint}`,
  };
}

function resolveGateDescriptors(
  a: FlowInstance,
  b: FlowInstance,
  schema: FlowSchema | undefined,
): GateDescriptor[] {
  if (schema) {
    return schema.gates.map(toGateDescriptor);
  }

  return inferGateOrder(a, b).map((gateId) => ({
    gateId,
    weight: "tactical",
  }));
}

function resolveGateDescriptorsFromInstances(
  instancesA: readonly FlowInstance[],
  instancesB: readonly FlowInstance[],
  schema: FlowSchema | undefined,
): GateDescriptor[] {
  if (schema) {
    return schema.gates.map(toGateDescriptor);
  }

  return inferGateOrderFromInstances([...instancesA, ...instancesB]).map((gateId) => ({
    gateId,
    weight: "tactical",
  }));
}

function inferGateOrder(
  a: FlowInstance,
  b: FlowInstance,
): string[] {
  return inferGateOrderFromSequences([
    uniqueGateOrder(a.selections),
    uniqueGateOrder(b.selections),
  ]);
}

function inferGateOrderFromInstances(
  instances: readonly FlowInstance[],
): string[] {
  return inferGateOrderFromSequences(instances.map((instance) => uniqueGateOrder(instance.selections)));
}

function inferGateOrderFromSequences(
  sequences: readonly string[][],
): string[] {
  const nonEmptySequences = sequences.filter((sequence) => sequence.length > 0);
  const adjacency = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const appearance = new Map<string, number>();
  let nextOrder = 0;

  for (const sequence of nonEmptySequences) {
    for (const gateId of sequence) {
      if (!adjacency.has(gateId)) {
        adjacency.set(gateId, new Set());
      }
      if (!inDegree.has(gateId)) {
        inDegree.set(gateId, 0);
      }
      if (!appearance.has(gateId)) {
        appearance.set(gateId, nextOrder++);
      }
    }

    for (let index = 0; index < sequence.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < sequence.length; nextIndex += 1) {
        const from = sequence[index];
        const to = sequence[nextIndex];
        const edges = adjacency.get(from)!;
        if (!edges.has(to)) {
          edges.add(to);
          inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
        }
      }
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([gateId]) => gateId)
    .sort((left, right) => (appearance.get(left) ?? 0) - (appearance.get(right) ?? 0));
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);

    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
        queue.sort((left, right) => (appearance.get(left) ?? 0) - (appearance.get(right) ?? 0));
      }
    }
  }

  if (ordered.length === adjacency.size) {
    return ordered;
  }

  const remaining = [...adjacency.keys()]
    .filter((gateId) => !ordered.includes(gateId))
    .sort((left, right) => (appearance.get(left) ?? 0) - (appearance.get(right) ?? 0));

  return [...ordered, ...remaining];
}

function uniqueGateOrder(selections: readonly GateSelection[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const selection of selections) {
    if (seen.has(selection.gateId)) {
      continue;
    }
    seen.add(selection.gateId);
    ordered.push(selection.gateId);
  }

  return ordered;
}

function buildSelectionMap(
  selections: readonly GateSelection[],
): ReadonlyMap<string, GateSelection> {
  return new Map(selections.map((selection) => [selection.gateId, cloneSelection(selection)]));
}

function findSelection(
  instance: FlowInstance,
  gateId: string,
): GateSelection | undefined {
  for (let index = instance.selections.length - 1; index >= 0; index -= 1) {
    const selection = instance.selections[index];
    if (selection.gateId === gateId) {
      return cloneSelection(selection);
    }
  }

  return undefined;
}

function resolveCompletedRange(
  store: InstanceStore,
  schemaId: string,
  range: ComparisonTimeRange,
): FlowInstance[] {
  return store.findByTimeRange({
    schemaId,
    from: range.from,
    to: range.to,
  }).filter((instance) => instance.status === "completed");
}

function assertSufficientSampleSize(
  instances: readonly FlowInstance[],
  label: string,
): void {
  if (instances.length < 2) {
    throw new Error(`${label} 비교에는 완료 인스턴스가 최소 2건 필요하다`);
  }
}

function collectSelectedGateIds(
  instances: readonly FlowInstance[],
): string[] {
  return instances.flatMap((instance) => uniqueGateOrder(instance.selections));
}

function buildGateDistributionShift(
  descriptor: GateDescriptor,
  instancesA: readonly FlowInstance[],
  instancesB: readonly FlowInstance[],
): GateDistributionShift {
  const selectionsA = instancesA
    .map((instance) => findSelection(instance, descriptor.gateId))
    .filter((selection): selection is GateSelection => selection !== undefined);
  const selectionsB = instancesB
    .map((instance) => findSelection(instance, descriptor.gateId))
    .filter((selection): selection is GateSelection => selection !== undefined);
  const totalSelectionsA = selectionsA.length;
  const totalSelectionsB = selectionsB.length;
  const branchIds = new Set<string>([
    ...selectionsA.map((selection) => selection.branchId),
    ...selectionsB.map((selection) => selection.branchId),
  ]);
  const branches = [...branchIds]
    .map((branchId) => {
      const countA = selectionsA.filter((selection) => selection.branchId === branchId).length;
      const countB = selectionsB.filter((selection) => selection.branchId === branchId).length;
      const ratioA = totalSelectionsA === 0 ? 0 : normalizeWeight(countA / totalSelectionsA);
      const ratioB = totalSelectionsB === 0 ? 0 : normalizeWeight(countB / totalSelectionsB);
      const deltaRatio = normalizeWeight(ratioB - ratioA);

      return {
        branchId,
        countA,
        countB,
        ratioA,
        ratioB,
        deltaRatio,
        shiftPercentage: normalizeWeight(Math.abs(deltaRatio) * 100),
      };
    })
    .sort((a, b) =>
      b.shiftPercentage - a.shiftPercentage
      || b.countB - a.countB
      || a.branchId.localeCompare(b.branchId),
    );

  return {
    gateId: descriptor.gateId,
    gateName: descriptor.gateName,
    phase: descriptor.phase,
    weight: descriptor.weight,
    totalSelectionsA,
    totalSelectionsB,
    totalShiftPercentage: normalizeWeight(
      branches.reduce((sum, branch) => sum + Math.abs(branch.deltaRatio), 0) * 50,
    ),
    dominantBranchA: dominantBranchId(selectionsA),
    dominantBranchB: dominantBranchId(selectionsB),
    branches,
  };
}

function buildPathBuckets(
  instances: readonly FlowInstance[],
  descriptors: readonly GateDescriptor[],
): ReadonlyMap<string, { path: ComparedPathSegment[]; count: number }> {
  const buckets = new Map<string, { path: ComparedPathSegment[]; count: number }>();

  for (const instance of instances) {
    const path = descriptors.flatMap((descriptor) => {
      const selection = findSelection(instance, descriptor.gateId);
      return selection
        ? [{ gateId: descriptor.gateId, branchId: selection.branchId }]
        : [];
    });
    if (path.length === 0) {
      continue;
    }

    const signature = serializePath(path);
    const bucket = buckets.get(signature);
    if (bucket) {
      bucket.count += 1;
      continue;
    }

    buckets.set(signature, { path, count: 1 });
  }

  return buckets;
}

function diffPathBuckets(
  bucketsA: ReadonlyMap<string, { path: ComparedPathSegment[]; count: number }>,
  bucketsB: ReadonlyMap<string, { path: ComparedPathSegment[]; count: number }>,
  direction: "emerged" | "disappeared",
): TimeRangePathChange[] {
  const source = direction === "emerged" ? bucketsB : bucketsA;
  const baseline = direction === "emerged" ? bucketsA : bucketsB;

  return [...source.entries()]
    .filter(([signature]) => !baseline.has(signature))
    .map(([signature, bucket]) => ({
      signature,
      path: bucket.path,
      countA: bucketsA.get(signature)?.count ?? 0,
      countB: bucketsB.get(signature)?.count ?? 0,
    }))
    .sort((a, b) => {
      const countDeltaA = direction === "emerged" ? b.countB - a.countB : b.countA - a.countA;
      return countDeltaA || a.signature.localeCompare(b.signature);
    });
}

function buildGateDiff(
  descriptor: GateDescriptor,
  selectionA: GateSelection | undefined,
  selectionB: GateSelection | undefined,
): GateDiff {
  const status = selectionA !== undefined
    && selectionB !== undefined
    && selectionA.branchId === selectionB.branchId
    ? "match"
    : "diverge";
  const evidenceDiff = compareEvidence(selectionA, selectionB);

  return {
    gateId: descriptor.gateId,
    gateName: descriptor.gateName,
    phase: descriptor.phase,
    weight: descriptor.weight,
    emphasis: status === "diverge" && descriptor.weight === "core" ? "core" : "standard",
    status,
    branchA: selectionA?.branchId,
    branchB: selectionB?.branchId,
    selectionA,
    selectionB,
    evidenceDiff,
  };
}

function compareEvidence(
  selectionA: GateSelection | undefined,
  selectionB: GateSelection | undefined,
): EvidenceDiff {
  const evidenceA = cloneEvidenceList(selectionA?.evidence ?? []);
  const evidenceB = cloneEvidenceList(selectionB?.evidence ?? []);
  const shared: Evidence[] = [];
  const onlyInA: Evidence[] = [];
  const bucketB = new Map<string, Evidence[]>();

  for (const evidence of evidenceB) {
    const key = serializeEvidence(evidence);
    const bucket = bucketB.get(key) ?? [];
    bucket.push(evidence);
    bucketB.set(key, bucket);
  }

  for (const evidence of evidenceA) {
    const key = serializeEvidence(evidence);
    const matched = bucketB.get(key);
    if (matched && matched.length > 0) {
      shared.push(evidence);
      matched.shift();
      if (matched.length === 0) {
        bucketB.delete(key);
      }
      continue;
    }

    onlyInA.push(evidence);
  }

  const onlyInB = [...bucketB.values()].flatMap((bucket) => bucket);
  const totalWeightA = totalEvidenceWeight(evidenceA);
  const totalWeightB = totalEvidenceWeight(evidenceB);

  return {
    hasDifference: onlyInA.length > 0 || onlyInB.length > 0,
    shared,
    onlyInA,
    onlyInB,
    totalWeightA,
    totalWeightB,
    weightDelta: normalizeWeight(totalWeightA - totalWeightB),
    confidenceA: selectionA?.confidence,
    confidenceB: selectionB?.confidence,
    kindHistogramA: toKindHistogram(evidenceA),
    kindHistogramB: toKindHistogram(evidenceB),
  };
}

function cloneSelection(selection: GateSelection): GateSelection {
  return {
    ...selection,
    evidence: cloneEvidenceList(selection.evidence),
    causedBy: selection.causedBy ? [...selection.causedBy] : undefined,
  };
}

function cloneEvidenceList(evidence: readonly Evidence[]): Evidence[] {
  return evidence.map((entry) => ({
    ...entry,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
  }));
}

function totalEvidenceWeight(evidence: readonly Evidence[]): number {
  return normalizeWeight(evidence.reduce((sum, entry) => sum + entry.weight, 0));
}

function toKindHistogram(evidence: readonly Evidence[]): Readonly<Record<string, number>> {
  const histogram = new Map<string, number>();

  for (const entry of evidence) {
    histogram.set(entry.kind, (histogram.get(entry.kind) ?? 0) + 1);
  }

  return Object.fromEntries([...histogram.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function collectEvidenceKinds(selection: GateSelection): string[] {
  return [...new Set(selection.evidence.map((entry) => entry.kind))].sort((a, b) => a.localeCompare(b));
}

function collectKinds(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((entry) => entry.kind))].sort((a, b) => a.localeCompare(b));
}

function toBranchDistribution(
  branchId: string,
  selections: readonly GateSelection[],
  totalSelections: number,
): BranchDistribution {
  const count = selections.length;
  const ratio = totalSelections === 0 ? 0 : normalizeWeight(count / totalSelections);

  return {
    branchId,
    count,
    ratio,
    averageConfidence: averageSelectionConfidence(selections),
    isDominant: ratio > 0.7,
  };
}

function toEvidenceKindCorrelation(
  evidenceKind: string,
  branchMap: ReadonlyMap<string, GateSelection[]>,
  totalSelections: number,
): EvidenceKindCorrelation {
  const selectionCount = [...branchMap.values()]
    .reduce((sum, selections) => sum + selections.length, 0);
  const branches = [...branchMap.entries()]
    .map(([branchId, selections]) => ({
      branchId,
      count: selections.length,
      ratio: selectionCount === 0 ? 0 : normalizeWeight(selections.length / selectionCount),
      averageConfidence: averageSelectionConfidence(selections),
    }))
    .sort((a, b) => b.count - a.count || a.branchId.localeCompare(b.branchId));
  const dominantBranch = branches.find((branch) => branch.ratio > 0.7);

  return {
    evidenceKind,
    selectionCount,
    selectionRatio: totalSelections === 0 ? 0 : normalizeWeight(selectionCount / totalSelections),
    branches,
    dominantBranchId: dominantBranch?.branchId,
  };
}

function averageSelectionConfidence(selections: readonly GateSelection[]): number {
  if (selections.length === 0) {
    return 0;
  }

  return normalizeWeight(
    selections.reduce((sum, selection) => sum + selection.confidence, 0) / selections.length,
  );
}

function serializeEvidence(evidence: Evidence): string {
  return [
    evidence.kind,
    evidence.source,
    evidence.content,
    String(evidence.weight),
    serializeUnknown(evidence.metadata),
  ].join("\u0000");
}

function serializePath(path: readonly ComparedPathSegment[]): string {
  return path.map((segment) => `${segment.gateId}:${segment.branchId}`).join("|");
}

function dominantBranchId(selections: readonly GateSelection[]): string | undefined {
  if (selections.length === 0) {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const selection of selections) {
    counts.set(selection.branchId, (counts.get(selection.branchId) ?? 0) + 1);
  }

  const dominant = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  return dominant?.[0];
}

function toGateDescriptor(gate: FlowSchema["gates"][number]): GateDescriptor {
  return {
    gateId: gate.id,
    gateName: gate.name,
    phase: gate.phase,
    weight: gate.weight ?? "tactical",
  };
}

function normalizeWeight(value: number): number {
  return Number(value.toFixed(12));
}

function serializeUnknown(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return `string:${value}`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${typeof value}:${String(value)}`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeUnknown(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${key}:${serializeUnknown(entry)}`)
      .join(",")}}`;
  }

  return String(value);
}

function formatKinds(kinds: readonly string[]): string {
  return kinds.length > 0 ? kinds.join(", ") : "공유되지 않은 추가 근거 없음";
}

function formatConfidence(confidence: number | undefined): string {
  return confidence === undefined ? "N/A" : String(normalizeWeight(confidence));
}
