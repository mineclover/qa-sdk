import type { GraphRegistry } from 'dkg';
import { bootstrapDkgBase, bootstrapDkgFinalize, type BootstrapDkgOptions } from 'dkg';
import { enrichDkgGraph } from './enrich-dkg-graph.js';

export { enrichDkgGraph } from './enrich-dkg-graph.js';
export { convergeChain } from './skills/converge-chain.js';
export type { ConvergeAction, ConvergeChainResult } from './skills/converge-chain.js';
export { auditCoverage } from './skills/coverage-audit.js';
export type { CoverageAuditResult } from './skills/coverage-audit.js';
export { traceFlows, validateDslInvariants } from './skills/flow-trace.js';
export type {
  FlowViolation,
  FlowTraceResult,
  DslInvariantViolation,
  DslInvariantResult,
} from './skills/flow-trace.js';

/** Base + enrichment + finalize — 기존 bootstrapDkg 동작과 동일 */
export function bootstrapDkg(options: BootstrapDkgOptions): GraphRegistry {
  const graph = bootstrapDkgBase(options);
  enrichDkgGraph(graph, options);
  return bootstrapDkgFinalize(graph, options);
}
