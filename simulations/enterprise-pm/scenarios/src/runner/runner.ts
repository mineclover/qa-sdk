// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import type {
  Scenario,
  ScenarioActResult,
  ScenarioEnv,
  ScenarioResult,
} from "./types.js";

/**
 * runScenario — Scenario 4 phase를 일관된 에러 격리로 실행.
 *
 * 동작:
 *   1. setup → ctx 생성. 실패 시 act/assert/teardown 스킵.
 *   2. act → ctx 기반 action steps 실행. 실패 시 assert 스킵하되 teardown 보장.
 *   3. assert → actResult 검증. 실패 시 status=failed, teardown 보장.
 *   4. teardown → 언제나 (setup 성공 후) 실행. 내부 실패 시 기존 에러가 없으면 teardown phase로 보고.
 *
 * 반환: { status, durationMs, stepCount, traceIds, error? }
 */
export async function runScenario<TCtx>(
  scenario: Scenario<TCtx>,
  env: ScenarioEnv,
): Promise<ScenarioResult> {
  const startedAt = Date.now();
  let ctx: TCtx | undefined;
  let actResult: ScenarioActResult = {
    data: {},
    traceIds: [] as string[],
    stepCount: 0,
  };
  let errPhase: "setup" | "act" | "assert" | "teardown" | null = null;
  let err: Error | null = null;

  try {
    try {
      ctx = await scenario.setup(env);
    } catch (e) {
      errPhase = "setup";
      err = e as Error;
      throw e;
    }
    try {
      actResult = await scenario.act(ctx as TCtx);
    } catch (e) {
      errPhase = "act";
      err = e as Error;
      throw e;
    }
    try {
      await scenario.assert(ctx as TCtx, actResult);
    } catch (e) {
      errPhase = "assert";
      err = e as Error;
      throw e;
    }
  } catch {
    // phase 정보는 위에서 이미 기록. teardown으로 전파.
  } finally {
    if (ctx !== undefined) {
      try {
        await scenario.teardown(ctx);
      } catch (e) {
        if (errPhase === null) {
          errPhase = "teardown";
          err = e as Error;
        }
        // assert/act 에러가 이미 있으면 teardown 에러는 로깅 대상이지만 본 runner는 첫 에러를 보고.
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  if (err) {
    return {
      name: scenario.name,
      status: "failed",
      durationMs,
      stepCount: actResult.stepCount,
      traceIds: actResult.traceIds,
      operatorHints: actResult.operatorHints,
      error: {
        message: err.message,
        stack: err.stack,
        phase: errPhase as "setup" | "act" | "assert" | "teardown",
      },
    };
  }
  return {
    name: scenario.name,
    status: "passed",
    durationMs,
    stepCount: actResult.stepCount,
    traceIds: actResult.traceIds,
    operatorHints: actResult.operatorHints,
  };
}
