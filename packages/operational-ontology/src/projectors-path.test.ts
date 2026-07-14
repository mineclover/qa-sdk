import { describe, expect, it } from 'vitest';
import type { NonLinearPathObservation } from '@qa-sdk/core';

import { projectPathObservationToOperationalOntology } from './index.js';

describe('projectPathObservationToOperationalOntology', () => {
  it('projects nonlinear observations into traversal observations and branch decisions', () => {
    const observation: NonLinearPathObservation = {
      reached_nodes: [
        {
          spec_step_id: 'start',
          runtime_node_id: 'run-1',
          event_key: 'order.submit',
          timestamp: '2026-04-09T00:00:00.000Z',
        },
      ],
      traversed_edges: [
        {
          from_step_id: 'start',
          to_step_id: 'validate',
          edge_type: 'branch',
        },
      ],
      reached_goals: ['validate'],
      unreachable_goals: [],
      loop_detected: false,
      recovery_used: false,
      terminal_node: 'run-1',
      terminal_reason: 'goal_reached',
      branchPoints: [
        {
          sourceStepId: 'start',
          branches: [
            {
              targetStepId: 'validate',
              edgeType: 'branch',
              taken: true,
              reachedNodes: [],
            },
            {
              targetStepId: 'reject',
              edgeType: 'optional',
              taken: false,
              reachedNodes: [],
            },
          ],
        },
      ],
      branchCoverage: { taken: 1, total: 2, rate: 0.5 },
    };

    const result = projectPathObservationToOperationalOntology({ observation });

    expect(result.traversalObservations).toHaveLength(1);
    expect(result.traversalObservations[0].traversal.purpose).toBe('observe');
    expect(result.branchDecisions).toEqual([
      {
        templateKind: 'observed_route_decision',
        templateDescription: 'Route decision materialized from observed branch outcomes',
        templateValidation: expect.objectContaining({ valid: true, pathCount: 2 }),
        branchNodeId: 'start',
        mode: 'first_match',
        selectedPathIds: ['start->validate'],
        skippedPathIds: ['start->reject'],
        reason: 'observed-paths',
      },
    ]);
  });

  it('materializes route decision metadata through the provided junction template registry', () => {
    const observation: NonLinearPathObservation = {
      reached_nodes: [],
      traversed_edges: [],
      reached_goals: [],
      unreachable_goals: [],
      loop_detected: false,
      recovery_used: false,
      terminal_node: null,
      terminal_reason: null,
      branchPoints: [
        {
          sourceStepId: 'start',
          branches: [
            {
              targetStepId: 'validate',
              edgeType: 'branch',
              taken: true,
              reachedNodes: [],
            },
          ],
        },
      ],
      branchCoverage: { taken: 1, total: 1, rate: 1 },
    };

    const customRegistry = {
      list() {
        return [
          {
            kind: 'conditional_branch',
            description: 'Custom conditional junction',
            allowedModes: ['first_match'],
          },
          {
            kind: 'observed_route_decision',
            description: 'Custom route decision junction',
            allowedModes: ['first_match'],
          },
        ] as const;
      },
      get(kind: 'conditional_branch' | 'observed_route_decision') {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectPathObservationToOperationalOntology({
      observation,
      junctionTemplateRegistry: customRegistry,
    });

    expect(result.branchDecisions).toEqual([
      {
        templateKind: 'observed_route_decision',
        templateDescription: 'Custom route decision junction',
        templateValidation: expect.objectContaining({
          valid: true,
          pathCount: 1,
        }),
        branchNodeId: 'start',
        mode: 'first_match',
        selectedPathIds: ['start->validate'],
        skippedPathIds: [],
        reason: 'observed-paths',
      },
    ]);
  });
});
