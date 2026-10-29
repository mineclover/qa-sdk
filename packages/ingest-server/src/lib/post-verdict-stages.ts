// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * Post-verdict 단계 — inline(`processPendingPhaseTwo`)·queue(`processPhaseTwoTask`) 공용.
 *
 * verdict 계산이 실패하지 않은 trace에 대해 다음을 실행한다.
 * - Phase 2.5 transition matching: address_context 디코딩 → `processSession`. 결과는 로그만 남긴다
 *   (transition 결과 저장은 G3 범위 — docs/proposals/swc-next-qa-sdk-optimization/README.md R-8)
 * - Phase 3 convergence 알림: `notifyCompletion(traceIds)`
 *
 * 에러 격리: 어떤 단계 실패도 던지지 않는다. 실패는 logger.error + `phase_two_failures_total{stage}`로 남고
 * verdict 저장·job 성공에 영향을 주지 않는다 (fail-open).
 */

import type { RecordStore, StoredRecord } from '@qa-sdk/core';
import type { Logger } from 'pino';
import { decodeAddressContext } from './decode-client.js';
import type { MetricsCounterPort } from './metrics-collector.js';

/** convergence 파이프라인 최소 인터페이스 (순환 의존 방지) */
export interface ConvergencePipelinePort {
  notifyCompletion(traceIds: readonly string[]): void;
}

/** TransitionFunctions 최소 인터페이스 (순환 의존 방지) */
export interface TransitionEnginePort {
  processSession(input: { readonly sessionId: string; readonly events: readonly unknown[] }): {
    readonly instances: readonly unknown[];
    readonly violations: readonly unknown[];
    readonly unmatchedCount: number;
  };
  decodeCtx(catalog: unknown, encoded: Record<string, string>): Record<string, string>;
}

/** Phase 2 실패 counter 이름 — label `stage`로 단계를 구분한다 */
export const PHASE_TWO_FAILURES_METRIC = 'phase_two_failures_total';
/** decode-service 응답이 없어 로컬 decode로 대체한 횟수 */
export const DECODE_SKIPPED_METRIC = 'decode_skipped_total';

export type PhaseTwoStage =
  | 'reconstruction'
  | 'verdict'
  | 'metric_aggregation'
  | 'transition'
  | 'convergence';

export function countPhaseTwoFailure(
  metricsCollector: MetricsCounterPort | undefined,
  stage: PhaseTwoStage,
): void {
  metricsCollector?.increment(PHASE_TWO_FAILURES_METRIC, { stage });
}

export interface PostVerdictStageDeps {
  recordStore: Pick<RecordStore, 'findByTraceId'>;
  /** 설정 시 Phase 2.5 transition matching 실행 (transitionCatalog와 함께 필요) */
  transitionEngine?: TransitionEnginePort;
  transitionCatalog?: unknown;
  /** decode-service URL — 설정 시 address_context 디코딩에 외부 서비스 우선 사용 */
  decodeServiceUrl?: string;
  convergencePipeline?: ConvergencePipelinePort;
  logger?: Pick<Logger, 'warn' | 'error'>;
  metricsCollector?: MetricsCounterPort;
}

export interface PostVerdictStageResult {
  /** transition engine이 평가한 trace 수 (`processSession` 호출 수) */
  transitions: number;
  /** convergence에 알린 trace 수 (실패 시 0) */
  convergenceNotified: number;
}

export async function runPostVerdictStages(
  deps: PostVerdictStageDeps,
  traceIds: readonly string[],
): Promise<PostVerdictStageResult> {
  if (traceIds.length === 0) {
    return { transitions: 0, convergenceNotified: 0 };
  }

  const transitions = await runTransitionStage(deps, traceIds);

  let convergenceNotified = 0;
  if (deps.convergencePipeline) {
    try {
      deps.convergencePipeline.notifyCompletion(traceIds);
      convergenceNotified = traceIds.length;
    } catch (error) {
      countPhaseTwoFailure(deps.metricsCollector, 'convergence');
      deps.logger?.error(
        { err: error, traceCount: traceIds.length },
        'convergence notification failed — verdict unaffected',
      );
    }
  }

  return { transitions, convergenceNotified };
}

/** Phase 2.5 — trace별로 격리해 한 trace 실패가 나머지 trace 평가를 막지 않는다 */
async function runTransitionStage(
  deps: PostVerdictStageDeps,
  traceIds: readonly string[],
): Promise<number> {
  const { transitionEngine, transitionCatalog } = deps;
  if (!transitionEngine || !transitionCatalog) return 0;

  let evaluated = 0;
  for (const traceId of traceIds) {
    try {
      const records = await deps.recordStore.findByTraceId(traceId);
      const events = await decodeTransitionEvents(
        deps,
        transitionEngine,
        transitionCatalog,
        records,
      );
      if (events.length === 0) continue;

      const result = transitionEngine.processSession({ sessionId: traceId, events });
      evaluated++;

      if (result.violations.length > 0) {
        deps.logger?.warn(
          { traceId, violations: result.violations.length, instances: result.instances.length },
          'transition violations detected',
        );
      }
    } catch (error) {
      countPhaseTwoFailure(deps.metricsCollector, 'transition');
      deps.logger?.error(
        { err: error, traceId },
        'transition matching failed (Phase 2.5) — verdict unaffected',
      );
    }
  }
  return evaluated;
}

/** address_context가 있는 레코드만 디코딩해 transition 입력 이벤트로 만든다 */
async function decodeTransitionEvents(
  deps: PostVerdictStageDeps,
  transitionEngine: TransitionEnginePort,
  transitionCatalog: unknown,
  records: readonly StoredRecord[],
): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  for (const r of records) {
    if (!r.addressContext || typeof r.addressContext !== 'object') continue;
    const ctx = r.addressContext as Record<string, string>;

    // 1) decode-service 우선 시도 (설정된 경우)
    let decoded: Record<string, string> | undefined;
    if (deps.decodeServiceUrl) {
      const result = await decodeAddressContext(deps.decodeServiceUrl, ctx);
      if (result) {
        decoded = {};
        for (const [k, v] of Object.entries(result)) {
          for (const [ek, ev] of Object.entries(v.entities)) {
            decoded[`${k}.${ek}`] = ev;
          }
        }
      } else {
        deps.metricsCollector?.increment(DECODE_SKIPPED_METRIC);
      }
    }
    // 2) 로컬 fallback
    if (!decoded) {
      decoded = transitionEngine.decodeCtx(transitionCatalog, ctx);
    }
    events.push({
      ...r,
      log_id: r.logId ?? '',
      timestamp: r.createdAt ?? r.timestamp ?? '',
      address_context: decoded,
    });
  }
  return events;
}
