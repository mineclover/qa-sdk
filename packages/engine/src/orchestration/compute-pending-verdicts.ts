import type {
  DlqStore,
  GraphStore,
  ScenarioSpecStore,
  SessionStore,
  TraceStore,
  VerdictInsert,
  VerdictStore,
} from "@qa-sdk/core";
import { newDlqId, newVerdictId } from "@qa-sdk/core";
import { compileSpec } from "../spec-compiler/compile.js";
import { matchGraphs } from "../matching/graph-matcher.js";
import { computeVerdict } from "../verdict/compute.js";

export interface ComputePendingVerdictsDeps {
  traceStore: Pick<TraceStore, "findById">;
  sessionStore: Pick<SessionStore, "findById">;
  graphStore: Pick<GraphStore, "findByTraceId">;
  scenarioSpecStore: Pick<ScenarioSpecStore, "findById">;
  verdictStore: Pick<VerdictStore, "insert" | "findByScenarioAndTrace" | "removeByScenarioAndTrace">;
  dlqStore: Pick<DlqStore, "insert">;
}

export interface ComputePendingVerdictsOptions {
  /** true면 기존 verdict를 삭제하고 재계산 */
  force?: boolean;
  onError?: (traceId: string, error: unknown) => void;
}

export interface ComputePendingVerdictsResult {
  computed: Array<{ traceId: string; scenarioId: string }>;
  skipped: string[];
  failed: string[];
}

/**
 * 재구성된 trace들에 대해 verdict를 계산한다.
 *
 * 각 trace의 session에 scenarioId가 설정되어 있으면
 * 해당 시나리오로 compileSpec → matchGraphs → computeVerdict → store.
 *
 * force=false(기본): 이미 verdict가 있는 (scenarioId, traceId) 조합은 건너뜀.
 * force=true: 기존 verdict를 삭제하고 재계산.
 */
export async function computePendingVerdicts(
  deps: ComputePendingVerdictsDeps,
  traceIds: string[],
  options: ComputePendingVerdictsOptions = {},
): Promise<ComputePendingVerdictsResult> {
  const computed: Array<{ traceId: string; scenarioId: string }> = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const traceId of traceIds) {
    try {
      const result = await computeTraceVerdict(deps, traceId, options);

      if (result.status === "skipped") {
        skipped.push(traceId);
        continue;
      }

      computed.push({ traceId, scenarioId: result.scenarioId });
    } catch (error) {
      failed.push(traceId);
      await deps.dlqStore.insert({
        id: newDlqId(),
        traceId,
        phase: "verdict",
        errorMessage: toErrorMessage(error),
      });
      options.onError?.(traceId, error);
    }
  }

  return { computed, skipped, failed };
}

export type ComputeTraceVerdictResult =
  | { status: "computed"; traceId: string; scenarioId: string }
  | { status: "skipped"; traceId: string };

export async function computeTraceVerdict(
  deps: Pick<
    ComputePendingVerdictsDeps,
    | "traceStore"
    | "sessionStore"
    | "graphStore"
    | "scenarioSpecStore"
    | "verdictStore"
  >,
  traceId: string,
  options: Pick<ComputePendingVerdictsOptions, "force"> = {},
): Promise<ComputeTraceVerdictResult> {
  const trace = await deps.traceStore.findById(traceId);
  if (!trace?.sessionId) {
    return { status: "skipped", traceId };
  }

  const session = await deps.sessionStore.findById(trace.sessionId);
  if (!session?.scenarioId) {
    return { status: "skipped", traceId };
  }

  const scenarioSpec = await deps.scenarioSpecStore.findById(session.scenarioId);
  if (!scenarioSpec) {
    return { status: "skipped", traceId };
  }

  const existing = await deps.verdictStore.findByScenarioAndTrace(
    scenarioSpec.scenario_id,
    traceId,
  );

  if (existing && !options.force) {
    return { status: "skipped", traceId };
  }

  if (existing && options.force) {
    await deps.verdictStore.removeByScenarioAndTrace(
      scenarioSpec.scenario_id,
      traceId,
    );
  }

  const graph = await deps.graphStore.findByTraceId(traceId);
  if (!graph) {
    return { status: "skipped", traceId };
  }

  const specGraph = compileSpec(scenarioSpec);
  const matchResult = matchGraphs(specGraph, graph);
  const report = computeVerdict(matchResult, specGraph, graph, session.sessionId);

  const verdictInsert: VerdictInsert = {
    id: newVerdictId(),
    scenarioId: scenarioSpec.scenario_id,
    traceId,
    qaSessionId: session.sessionId,
    overallVerdict: report.overall_verdict,
    report,
  };

  await deps.verdictStore.insert(verdictInsert);

  return {
    status: "computed",
    traceId,
    scenarioId: scenarioSpec.scenario_id,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
