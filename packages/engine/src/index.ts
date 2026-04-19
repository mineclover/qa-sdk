// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

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
export { matchViaPathMatcher } from "./matching/path-matcher-adapter.js";

// ── Path Observation ─────────────────────────────────────

export { derivePathObservation } from "./path-observation/observe-path.js";

// ── Verdict ─────────────────────────────────────────────

export { computeVerdict } from "./verdict/compute.js";
