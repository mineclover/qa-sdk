// ── Reconstruction ──────────────────────────────────────

export { groupByTrace } from "./reconstruction/trace-grouper.js";
export { sortByTimestamp } from "./reconstruction/timestamp-sorter.js";
export { buildSpanTree } from "./reconstruction/span-tree-builder.js";
export {
  buildTemporalEdges,
  buildGlobalTemporalEdges,
} from "./reconstruction/edge-factory.js";
export { reconstruct } from "./reconstruction/reconstruct.js";
export type { ReconstructionOptions } from "./reconstruction/reconstruct.js";
export {
  reconstructTrace,
  reconstructPendingTraces,
} from "./orchestration/reconstruct-pending-traces.js";
export type {
  ReconstructPendingTracesDeps,
  ReconstructPendingTracesOptions,
  ReconstructPendingTracesResult,
} from "./orchestration/reconstruct-pending-traces.js";

export {
  computeTraceVerdict,
  computePendingVerdicts,
} from "./orchestration/compute-pending-verdicts.js";
export type {
  ComputeTraceVerdictResult,
  ComputePendingVerdictsDeps,
  ComputePendingVerdictsOptions,
  ComputePendingVerdictsResult,
} from "./orchestration/compute-pending-verdicts.js";

// ── Spec Compiler ───────────────────────────────────────

export { compileSpec } from "./spec-compiler/compile.js";

// ── Matching ────────────────────────────────────────────

export {
  evaluateConstraint,
  evaluateConstraints,
} from "./matching/constraint-evaluator.js";
export { matchGraphs } from "./matching/graph-matcher.js";

// ── Verdict ─────────────────────────────────────────────

export { computeVerdict } from "./verdict/compute.js";
