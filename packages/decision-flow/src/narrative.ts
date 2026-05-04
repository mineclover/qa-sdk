// @def.boundary df-narrative-group
/**
 * 서사 빌더 (Narrative Builder)
 *
 * FlowInstance의 완료된 여정에서 서사를 추출한다.
 *
 * 개별 결정(gate 선택)이 모여서 결정 공간의 한 점에 도달하고,
 * 그 경험이 서사로 기록된다.
 *
 * 서사는 지워지지 않는다.
 * 같은 결정 공간의 같은 점이라도, 다른 시점에 다른 근거로 도달했으면 다른 서사다.
 * 서사가 쌓이면 "이 결정 공간의 이 영역은 어떤 맥락에서 도달하는가"를 알 수 있다.
 */

import type {
  FlowInstance,
  FlowSchema,
  DecisionNarrative,
  DecisionVerdict,
  DecisionVerdictRecord,
  NarrativeContext,
  NarrativeStep,
  NarrativeDestination,
  NarrativeOutcome,
  NarrativeReflection,
} from "./types.js";
import { decodePath } from "./coordinate.js";

let narrativeCounter = 0;

/** 서사 빌드 입력 */
export interface BuildNarrativeInput {
  /** 완료된 FlowInstance */
  readonly instance: FlowInstance;
  /** 스키마 (gate 이름, weight 등 메타데이터 참조) */
  readonly schema: FlowSchema;
  /** 배경: 왜 이 결정이 필요했는가 */
  readonly context: NarrativeContext;
  /** 산출: 이 결정이 만들어낸 것 */
  readonly outcome: NarrativeOutcome;
  /** 회고 (선택적 — 나중에 addReflection으로도 추가 가능) */
  readonly reflection?: NarrativeReflection;
}

/**
 * 완료된 FlowInstance에서 서사를 추출한다.
 *
 * instance.selections의 각 항목이 여정(journey)의 한 걸음이 되고,
 * instance.coordinateAddress가 도달점(destination)이 된다.
 */
export function buildNarrative(input: BuildNarrativeInput): DecisionNarrative {
  const { instance, schema, context, outcome, reflection } = input;

  if (instance.selections.length === 0 && instance.status !== "active") {
    throw new Error(`인스턴스 "${instance.id}"에 선택 이력이 없다 (status: ${instance.status})`);
  }

  // gate 메타데이터 매핑
  const gateMap = new Map(schema.gates.map((g) => [g.id, g]));

  // 여정: 각 selection → NarrativeStep
  const journey: NarrativeStep[] = instance.selections.map((sel) => {
    const gate = gateMap.get(sel.gateId);
    const isCore = gate?.weight === "core";
    const evidenceKinds = [...new Set(sel.evidence.map((e) => e.kind))];

    // 근거에서 한 줄 요약 추출 (weight 내림차순)
    const reason = sel.evidence.length > 0
      ? [...sel.evidence]
          .toSorted((a, b) => b.weight - a.weight)
          .map((e) => e.content)
          .join("; ")
      : "근거 없음";

    return {
      gateId: sel.gateId,
      gateName: gate?.name ?? sel.gateId,
      choice: sel.branchId,
      reason,
      confidence: sel.confidence,
      isCore,
      evidenceKinds,
    };
  });

  // 도달: 결정 공간에서의 최종 위치
  let selections: Record<string, string> = {};
  if (instance.coordinateAddress !== undefined) {
    const decoded = decodePath(schema, instance.coordinateAddress);
    selections = decoded.selections;
  } else {
    for (const sel of instance.selections) {
      selections[sel.gateId] = sel.branchId;
    }
  }

  const coreSelections: Record<string, string> = {};
  for (const step of journey) {
    if (step.isCore) {
      coreSelections[step.gateId] = step.choice;
    }
  }

  const destination: NarrativeDestination = {
    instanceId: instance.id,
    schemaId: instance.schemaId,
    address: instance.coordinateAddress,
    selections,
    coreSelections,
  };

  return {
    id: `NAR-${Date.now()}-${++narrativeCounter}`,
    recordedAt: new Date().toISOString(),
    unit: schema.unit,
    context,
    journey,
    destination,
    outcome,
    reflection,
  };
}

/**
 * 서사에서 코어 전환점(pivot points)만 추출한다.
 *
 * 코어 gate에서의 선택은 결정 공간에서의 "주요 차원"을 결정한다.
 * 서사를 요약할 때는 코어 전환점만 읽으면 된다.
 */
export function extractPivotPoints(narrative: DecisionNarrative): readonly NarrativeStep[] {
  return narrative.journey.filter((step) => step.isCore);
}

/**
 * 서사를 한 줄 요약으로 압축한다.
 *
 * 형식: "{context.trigger} → {코어 선택들} → {outcome.artifactType}"
 */
export function summarizeNarrative(narrative: DecisionNarrative): string {
  const pivots = extractPivotPoints(narrative);
  const pivotSummary = pivots.length > 0
    ? pivots.map((p) => `${p.gateName}=${p.choice}`).join(", ")
    : Object.entries(narrative.destination.selections)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");

  return `${narrative.context.trigger} → [${pivotSummary}] → ${narrative.outcome.artifactType}:${narrative.outcome.artifactRef}`;
}

/**
 * 두 서사의 여정을 비교하여 분기점을 찾는다.
 *
 * "같은 배경에서 출발했는데 왜 다른 곳에 도달했는가?"
 */
export function findNarrativeDivergence(
  a: DecisionNarrative,
  b: DecisionNarrative,
): NarrativeDivergence | null {
  for (let i = 0; i < Math.min(a.journey.length, b.journey.length); i++) {
    const stepA = a.journey[i];
    const stepB = b.journey[i];
    if (stepA.gateId === stepB.gateId && stepA.choice !== stepB.choice) {
      return {
        stepIndex: i,
        gateId: stepA.gateId,
        gateName: stepA.gateName,
        choiceA: stepA.choice,
        choiceB: stepB.choice,
        reasonA: stepA.reason,
        reasonB: stepB.reason,
        isCore: stepA.isCore,
      };
    }
  }
  return null;
}

/**
 * 서사에 판정을 기록한다.
 *
 * 과정(배경→여정→도달→산출)은 결정 시점에 기록되지만,
 * 판정(성공/실패/보류)은 시간이 지난 후 기록된다.
 *
 * 원본 서사는 불변이므로 새 서사 객체를 반환한다.
 */
export function recordVerdict(
  narrative: DecisionNarrative,
  verdict: DecisionVerdictRecord,
): DecisionNarrative {
  return { ...narrative, verdict };
}

/**
 * 의사결정 단위의 성공 기준 충족 여부를 평가한다.
 *
 * unit.successCriteria에 대해 각각의 충족 여부를 체크하고
 * DecisionVerdictRecord를 생성한다.
 */
export function evaluateDecision(
  narrative: DecisionNarrative,
  criteriaResults: readonly { criterion: string; met: boolean; evidence?: string }[],
): DecisionVerdictRecord {
  const allMet = criteriaResults.every((r) => r.met);
  const noneMet = criteriaResults.every((r) => !r.met);

  let verdict: DecisionVerdict;
  let reason: string;
  if (allMet) {
    verdict = "success";
    reason = `${criteriaResults.length}개 기준 전부 충족`;
  } else if (noneMet) {
    verdict = "failure";
    reason = `${criteriaResults.length}개 기준 전부 미충족`;
  } else {
    const metCount = criteriaResults.filter((r) => r.met).length;
    verdict = "deferred";
    reason = `${criteriaResults.length}개 기준 중 ${metCount}개 충족 — 추가 검증 필요`;
  }

  return {
    verdict,
    reason,
    criteriaResults,
    judgedAt: new Date().toISOString(),
  };
}

/**
 * 서사의 과정과 결론을 구분하여 요약한다.
 */
export function summarizeDecisionOutcome(narrative: DecisionNarrative): string {
  const parts: string[] = [];

  // 과정 요약
  if (narrative.unit) {
    parts.push(`[주제] ${narrative.unit.topic}`);
    parts.push(`[목적] ${narrative.unit.objective}`);
  }

  // 결정 경로
  const pivots = extractPivotPoints(narrative);
  if (pivots.length > 0) {
    parts.push(`[결정] ${pivots.map((p) => `${p.gateName}=${p.choice}`).join(", ")}`);
  }

  // 결론
  if (narrative.verdict) {
    const v = narrative.verdict;
    const metCount = v.criteriaResults.filter((r) => r.met).length;
    parts.push(`[결론] ${v.verdict} (${metCount}/${v.criteriaResults.length} 기준 충족) — ${v.reason}`);
  } else {
    parts.push("[결론] 아직 판정 전");
  }

  return parts.join("\n");
}

/** 두 서사의 분기점 */
export interface NarrativeDivergence {
  readonly stepIndex: number;
  readonly gateId: string;
  readonly gateName: string;
  readonly choiceA: string;
  readonly choiceB: string;
  readonly reasonA: string;
  readonly reasonB: string;
  readonly isCore: boolean;
}
