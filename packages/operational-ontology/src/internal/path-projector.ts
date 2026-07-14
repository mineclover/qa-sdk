import {
  defaultJunctionTemplateRegistry,
  getJunctionTemplate,
  validateJunctionAgainstTemplate,
  type BranchDecision,
  type JunctionTemplateRegistry,
} from './junction-core.js';
import type {
  PathObservationProjectionInput,
  PathObservationProjectionResult,
} from './projector-types.js';
import { isNonLinearPathObservation } from './projector-shared.js';
import {
  createEdgeCanonicalKey,
  createTraversalCanonicalKey,
  type TraversalCoord,
  type TraversalObservation,
} from './runtime-core.js';

export function projectPathObservationToOperationalOntology(
  input: PathObservationProjectionInput,
): PathObservationProjectionResult {
  const { observation } = input;
  const routeTemplate = getJunctionTemplate(
    input.junctionTemplateRegistry ?? defaultJunctionTemplateRegistry,
    'observed_route_decision',
  );
  const edges = observation.traversed_edges.map((edge) =>
    createEdgeCanonicalKey({
      start: edge.from_step_id,
      relationType: `path:${edge.edge_type}`,
      end: edge.to_step_id,
    }),
  );
  const start =
    observation.reached_nodes[0]?.spec_step_id ??
    observation.traversed_edges[0]?.from_step_id ??
    'unknown:start';
  const end =
    observation.reached_nodes.at(-1)?.spec_step_id ??
    observation.traversed_edges.at(-1)?.to_step_id ??
    'unknown:end';
  const traversal: TraversalCoord = {
    purpose: 'observe',
    start,
    edges,
    end,
  };
  const traversalObservation: TraversalObservation = {
    traversal: {
      ...traversal,
      canonicalKey: createTraversalCanonicalKey(traversal),
    },
    reachedGoalIds: observation.reached_goals,
    unreachableGoalIds: observation.unreachable_goals,
    loopDetected: observation.loop_detected,
    recoveryUsed: observation.recovery_used,
    terminalNodeId: observation.terminal_node,
    terminalReason: observation.terminal_reason,
  };

  const branchDecisions = isNonLinearPathObservation(observation)
    ? observation.branchPoints.map((branchPoint) => {
        const selectedPathIds = branchPoint.branches
          .filter((branch) => branch.taken)
          .map((branch) => `${branchPoint.sourceStepId}->${branch.targetStepId}`);
        const skippedPathIds = branchPoint.branches
          .filter((branch) => !branch.taken)
          .map((branch) => `${branchPoint.sourceStepId}->${branch.targetStepId}`);

        return {
          templateKind: 'observed_route_decision',
          templateDescription: routeTemplate.description,
          templateValidation: validateJunctionAgainstTemplate(
            selectedPathIds.length > 1 ? 'all_matches' : 'first_match',
            routeTemplate,
            [
              ...selectedPathIds.map((pathId) => ({
                pathId,
                nextNodeIds: [],
              })),
              ...skippedPathIds.map((pathId) => ({
                pathId,
                nextNodeIds: [],
              })),
            ],
          ),
          branchNodeId: branchPoint.sourceStepId,
          mode: selectedPathIds.length > 1 ? 'all_matches' : 'first_match',
          selectedPathIds,
          skippedPathIds,
          reason: selectedPathIds.length > 0 ? 'observed-paths' : 'no-path-observed',
        } satisfies BranchDecision;
      })
    : [];

  return {
    traversalObservations: [traversalObservation],
    branchDecisions,
  };
}
