/**
 * Violation Bridge — 전이 위반 → DKG Observation 변환.
 *
 * metricsToObservations 패턴과 대칭.
 * 위반은 항상 action-needed intent.
 */

import type { ObservationNode } from "../dkg/dkg.types.js";
import type { InputViolation } from "./input-validator.js";

/**
 * InputViolation[] → ObservationNode[] 변환.
 *
 * transition별 그룹핑. ID: `OBS-TRANSITION-{name}-{date}` (날짜 단위 멱등).
 */
export function violationsToObservations(
  violations: readonly InputViolation[],
  options?: { date?: string; source?: "runtime" | "review" | "metric" | "manual" },
): ObservationNode[] {
  if (violations.length === 0) return [];

  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const source = options?.source ?? "runtime";

  // transition별 그룹핑
  const byTransition = new Map<string, InputViolation[]>();
  for (const v of violations) {
    const list = byTransition.get(v.transition) ?? [];
    list.push(v);
    byTransition.set(v.transition, list);
  }

  const observations: ObservationNode[] = [];

  for (const [transition, transViolations] of byTransition) {
    const tspecId = `TSPEC-${transition.replace(/\./g, "-")}`;
    const violatedAxes = [...new Set(transViolations.map(v => v.axis))];

    observations.push({
      kind: "observation",
      id: `OBS-TRANSITION-${transition.replace(/\./g, "-")}-${date}`,
      date,
      source,
      subjects: [tspecId, ...violatedAxes],
      finding: `${transition}: input 위반 ${transViolations.length}건 — ${violatedAxes.join(", ")} 축 조건 불충족`,
      intent: "action-needed",
    });
  }

  return observations;
}
