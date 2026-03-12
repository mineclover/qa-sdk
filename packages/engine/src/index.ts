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
