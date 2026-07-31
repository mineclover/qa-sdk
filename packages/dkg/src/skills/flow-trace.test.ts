// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import { GraphRegistry } from '../graph-registry.js';
import {
  resolveRecoveredFlowObservations,
  traceFlows,
  validateDslInvariants,
} from './flow-trace.js';

describe('flow-trace', () => {
  it('detects missing IntentLink prerequisites', () => {
    const graph = new GraphRegistry();
    graph.addNode({
      kind: 'intent-link',
      id: 'IL-checkout',
      endpoints: ['page_view', 'flow_point'],
      via: 'address_context',
      intent: 'checkout',
      invariant: 'page_view 없이 flow_point가 관측되면 안 됨',
    });

    const result = traceFlows(graph, [
      { address_context: { flow_point: 'flow_point:v1:0' }, timestamp: '2026-06-18T00:00:00Z' },
    ]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.missingPrefixes).toContain('page_view');
    expect(result.observations[0]?.id).toContain('OBS-FLOW-IL-checkout');
  });

  it('validates DSL bundle invariants with exclusions', () => {
    const graph = new GraphRegistry();
    graph.addNode({
      kind: 'dsl-bundle',
      id: 'dsl-checkout',
      name: 'Checkout',
      description: 'Checkout flow',
      memberPrefixes: ['page_view', 'flow_point'],
      serviceBindingPrefix: 'service',
      fixedDims: [],
      invariants: ['page_view 없이 flow_point가 관측되면 안 됨'],
    });

    const records = [{ address_context: { flow_point: 'flow_point:v1:0' } }];

    expect(validateDslInvariants(graph, records).violations).toHaveLength(1);
    expect(
      validateDslInvariants(graph, records, { excludeBundles: ['dsl-checkout'] }).violations,
    ).toHaveLength(0);
  });

  it('resolves a prior flow observation only when its IntentLink is observed and clean', () => {
    const graph = new GraphRegistry();
    graph.addNode({
      kind: 'intent-link',
      id: 'IL-checkout',
      endpoints: ['page_view', 'flow_point'],
      via: 'address_context',
      intent: 'checkout',
      invariant: 'page_view 없이 flow_point가 관측되면 안 됨',
    });

    const prior = {
      kind: 'observation' as const,
      id: 'OBS-FLOW-IL-checkout-flow_point',
      date: '2026-06-18',
      source: 'runtime' as const,
      subjects: ['IL-checkout', 'flow_point', 'page_view'],
      finding: '이전 flow 위반',
      suggestion: {
        kind: 'revise-decision' as const,
        decisionId: 'IL-checkout',
        reason: 'page_view 없이 flow_point',
      },
    };
    const current = [
      {
        address_context: {
          page_view: 'page_view:v1:0',
          flow_point: 'flow_point:v1:0',
        },
      },
    ];
    const result = traceFlows(graph, current);

    const resolved = resolveRecoveredFlowObservations(graph, current, result, [prior], {
      date: '2026-07-31',
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.resolution?.decisionId).toBe('AUTO-RESOLVE');
  });

  it('does not resolve an unobserved or currently violating IntentLink', () => {
    const graph = new GraphRegistry();
    graph.addNode({
      kind: 'intent-link',
      id: 'IL-checkout',
      endpoints: ['page_view', 'flow_point'],
      via: 'address_context',
      intent: 'checkout',
      invariant: 'page_view 없이 flow_point가 관측되면 안 됨',
    });
    const prior = {
      kind: 'observation' as const,
      id: 'OBS-FLOW-IL-checkout-page_view',
      date: '2026-06-18',
      source: 'runtime' as const,
      subjects: ['IL-checkout', 'flow_point', 'page_view'],
      finding: '이전 flow 위반',
      suggestion: {
        kind: 'revise-decision' as const,
        decisionId: 'IL-checkout',
        reason: 'page_view 없이 flow_point',
      },
    };

    const unobserved = [{ address_context: { unrelated: 'unrelated:v1:0' } }];
    const unobservedResult = traceFlows(graph, unobserved);
    expect(
      resolveRecoveredFlowObservations(graph, unobserved, unobservedResult, [prior]),
    ).toHaveLength(0);

    const violating = [{ address_context: { flow_point: 'flow_point:v1:0' } }];
    const violatingResult = traceFlows(graph, violating);
    expect(
      resolveRecoveredFlowObservations(graph, violating, violatingResult, [prior]),
    ).toHaveLength(0);
  });
});
