// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * convergence pipeline이 쓰는 분석 함수 묶음을 로드한다.
 *
 * server.ts는 import 즉시 서버를 띄우므로 이 묶음을 별도 모듈로 두어 구성 누락을 테스트한다
 * (예: resolveRecoveredMetrics가 빠져 ok 복귀 metric observation이 해소되지 않던 문제 — U-1).
 */

import type { ConvergenceFunctions } from './convergence-pipeline.js';

export async function loadConvergenceFunctions(): Promise<ConvergenceFunctions> {
  const convergence = await import('@qa-sdk/convergence');
  const dkg = await import('@qa-sdk/spec-core/dkg');
  return {
    aggregateUsageData: convergence.aggregateUsageData,
    collectMetrics: convergence.collectMetrics,
    metricsToObservations: convergence.metricsToObservations,
    resolveRecoveredMetrics: convergence.resolveRecoveredMetrics,
    traceFlows: dkg.traceFlows,
    resolveRecoveredFlowObservations: dkg.resolveRecoveredFlowObservations,
  } as unknown as ConvergenceFunctions;
}
