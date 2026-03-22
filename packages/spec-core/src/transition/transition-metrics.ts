/**
 * Transition Metrics — Phase 2.5 결과에서 수렴 metric 값을 계산하는 순수 함수.
 *
 * collectMetrics와 별도로 동작. Phase 2.5 결과(TransitionSessionResult[])를
 * MetricValue[]로 변환한다. convergence-runner에서 병합 가능.
 */

import type { MetricValue, MetricStatus } from "@qa-sdk/convergence";
import type { TransitionSessionResult, TransitionFlushResult } from "./transition-pipeline.js";

const METRIC_IDS = {
  coverage: "metric:transition:coverage",
  violationRate: "metric:transition:violation-rate",
  orphanSequences: "metric:transition:orphan-sequences",
} as const;

function status(value: number, warning: number, critical: number, above: boolean): MetricStatus {
  if (above) {
    if (value >= critical) return "critical";
    if (value >= warning) return "warning";
    return "ok";
  }
  if (value <= critical) return "critical";
  if (value <= warning) return "warning";
  return "ok";
}

/**
 * TransitionSessionResult 배열에서 TransitionFlushResult를 집계한다.
 */
export function aggregateTransitionResults(
  results: readonly TransitionSessionResult[],
  totalSpecs: number,
): TransitionFlushResult {
  if (results.length === 0) {
    return {
      sessionsProcessed: 0,
      transitionsDetected: 0,
      violationsDetected: 0,
      coverageRate: 0,
      violationRate: 0,
      orphanSequences: 0,
    };
  }

  let totalTransitions = 0;
  let totalViolations = 0;
  let orphanSessions = 0;
  const matchedSpecs = new Set<string>();

  for (const r of results) {
    totalTransitions += r.instances.length;
    totalViolations += r.violations.length;
    if (r.unmatchedCount > 0) orphanSessions++;
    for (const inst of r.instances) {
      matchedSpecs.add(inst.transition_name);
    }
  }

  const totalAttempts = totalTransitions + totalViolations;

  return {
    sessionsProcessed: results.length,
    transitionsDetected: totalTransitions,
    violationsDetected: totalViolations,
    coverageRate: totalSpecs > 0 ? (matchedSpecs.size / totalSpecs) * 100 : 0,
    violationRate: totalAttempts > 0 ? (totalViolations / totalAttempts) * 100 : 0,
    orphanSequences: orphanSessions,
  };
}

/**
 * TransitionFlushResult → MetricValue[] 변환.
 * METRIC_DEFS의 transition category 3종에 대응.
 */
export function transitionFlushToMetrics(
  flush: TransitionFlushResult,
  date?: string,
): MetricValue[] {
  const d = date ?? new Date().toISOString().slice(0, 10);

  return [
    {
      id: METRIC_IDS.coverage,
      name: "전이 커버리지",
      value: Math.round(flush.coverageRate),
      status: status(flush.coverageRate, 50, 20, false),
      detail: `${flush.coverageRate.toFixed(0)}% specs 매칭`,
      target: "transition",
      measuredAt: d,
    },
    {
      id: METRIC_IDS.violationRate,
      name: "전이 위반율",
      value: Math.round(flush.violationRate),
      status: status(flush.violationRate, 20, 50, true),
      detail: `${flush.violationRate.toFixed(1)}% 위반율 (${flush.violationsDetected}/${flush.transitionsDetected + flush.violationsDetected})`,
      target: "transition",
      measuredAt: d,
    },
    {
      id: METRIC_IDS.orphanSequences,
      name: "미매칭 시퀀스",
      value: flush.orphanSequences,
      status: status(flush.orphanSequences, 10, 50, true),
      detail: `${flush.orphanSequences}개 세션에 미매칭 이벤트`,
      target: "transition",
      measuredAt: d,
    },
  ];
}
