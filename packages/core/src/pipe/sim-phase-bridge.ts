/**
 * 시뮬레이션 → TestPhase 브릿지
 *
 * SimulationResult의 각 step에 TestPhase를 부여한다.
 * 우선순위: PipeStep.testPhase 명시 > facet 기본 매핑 > "act" fallback
 */

import type { TestPhase } from "../types/test-tracking.js";
import { TEST_PHASES } from "../types/test-tracking.js";
import type { SimulationResult, SimStep } from "./pipe-simulate.js";

// ── facet → phase 기본 매핑 ─────────────────────────

const FACET_PHASE_MAP: Record<string, TestPhase> = {
  "정의": "arrange",
  "저장": "fixture",
  "소비": "act",
  "관리": "act",
  "생산": "observe",
};

const DEFAULT_PHASE: TestPhase = "act";

// ── 타입 ──────────────────────────────────────────────

export type PhaseAnnotatedStep = Omit<SimStep, "phase"> & {
  /** 부여된 테스트 단계 */
  phase: TestPhase;
  /** phase 출처: "explicit" (PipeStep.testPhase) | "facet-map" | "default" */
  phaseSource: "explicit" | "facet-map" | "default";
};

export interface SimPhaseResult {
  steps: PhaseAnnotatedStep[];
  /** 단계 순서 트레이스 (step kind만) */
  phaseTrace: TestPhase[];
  /** 커버리지 요약 */
  coverage: {
    covered: TestPhase[];
    uncovered: TestPhase[];
    rate: number;
  };
}

// ── 브릿지 함수 ──────────────────────────────────────

/**
 * 시뮬레이션 결과의 각 step에 TestPhase를 부여한다.
 *
 * - PipeStep.testPhase가 있으면 명시 사용 (explicit)
 * - 없으면 facet → phase 기본 매핑 (facet-map)
 * - facet도 없으면 "act" fallback (default)
 *
 * @param customMap facet→phase 커스텀 매핑 (기본 매핑 덮어쓰기)
 */
export function annotateSimPhases(
  result: SimulationResult,
  customMap?: Partial<Record<string, TestPhase>>,
): SimPhaseResult {
  const effectiveMap = customMap
    ? { ...FACET_PHASE_MAP, ...customMap }
    : FACET_PHASE_MAP;

  const steps: PhaseAnnotatedStep[] = [];
  const phaseTrace: TestPhase[] = [];

  for (const step of result.steps) {
    // step kind가 아닌 것(branch, parallel 등 제어 노드)은 phase 부여 안 함
    if (step.kind !== "step") continue;

    let phase: TestPhase;
    let phaseSource: PhaseAnnotatedStep["phaseSource"];

    if (step.phase && isValidPhase(step.phase)) {
      phase = step.phase as TestPhase;
      phaseSource = "explicit";
    } else if (step.facet && step.facet in effectiveMap) {
      phase = effectiveMap[step.facet]!;
      phaseSource = "facet-map";
    } else {
      phase = DEFAULT_PHASE;
      phaseSource = "default";
    }

    steps.push({
      pipeId: step.pipeId,
      flowPath: step.flowPath,
      kind: step.kind,
      facet: step.facet,
      eventKey: step.eventKey,
      timestamp: step.timestamp,
      status: step.status,
      phase,
      phaseSource,
    });
    phaseTrace.push(phase);
  }

  const coveredSet = new Set(phaseTrace);
  const covered = TEST_PHASES.filter(p => coveredSet.has(p));
  const uncovered = TEST_PHASES.filter(p => !coveredSet.has(p));

  return {
    steps,
    phaseTrace,
    coverage: {
      covered,
      uncovered,
      rate: TEST_PHASES.length > 0
        ? Math.round((covered.length / TEST_PHASES.length) * 100)
        : 0,
    },
  };
}

function isValidPhase(value: string): value is TestPhase {
  return (TEST_PHASES as readonly string[]).includes(value);
}

/** facet → phase 기본 매핑 테이블 (읽기 전용 노출) */
export const FACET_PHASE_DEFAULTS: Readonly<Record<string, TestPhase>> = FACET_PHASE_MAP;
