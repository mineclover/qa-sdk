// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import { GraphRegistry } from '../graph-registry.js';
import { auditDslOwnership } from './dsl-ownership-review.js';

describe('auditDslOwnership', () => {
  it('후보·downstream impact를 prefix별 pending unit으로 산출한다', () => {
    const graph = new GraphRegistry();
    graph.addNode({
      kind: 'prefix',
      id: 'decision_event',
      name: 'decision event',
      dimLabels: [],
      category: 'event',
      lifecycle: 'active',
    });
    graph.addNode({
      kind: 'prefix',
      id: 'ir_data',
      name: 'IR data',
      dimLabels: [],
      category: 'entity',
      lifecycle: 'active',
    });
    graph.addNode({
      kind: 'flow-schema',
      id: 'office-hours',
      name: 'office hours',
      version: 'v1',
      gates: [],
      totalPaths: 1,
      coreGateIds: [],
    });
    graph.addNode({
      kind: 'domain',
      id: 'decision-domain',
      name: 'decision domain',
      prefixes: ['decision_event'],
      sharedAxes: [],
      boundary: { exports: [], internal: [] },
    });
    graph.addNode({
      kind: 'consumer',
      id: 'decision-consumer',
      name: 'decision consumer',
      intendedPrefixes: ['decision_event'],
    });
    graph.addNode({
      kind: 'intent-link',
      id: 'intent-decision',
      endpoints: ['decision_event'],
      via: 'decision-domain',
      intent: 'persist decision evidence',
    });
    graph.addNode({
      kind: 'observation',
      id: 'OBS-DSL-UNCOVERED',
      date: '2026-07-31',
      source: 'metric',
      subjects: ['decision_event', 'ir_data'],
      finding: 'uncovered',
    });
    graph.addEdge('observes', 'OBS-DSL-UNCOVERED', 'decision_event');
    graph.addEdge('observes', 'OBS-DSL-UNCOVERED', 'ir_data');
    graph.addEdge('observes', 'office-hours', 'decision_event');
    graph.addEdge('contains', 'decision-domain', 'decision_event');
    graph.addEdge('consumes', 'decision-consumer', 'decision-domain');
    graph.addEdge('binds', 'intent-decision', 'decision_event');

    const result = auditDslOwnership(graph);

    expect(result).toMatchObject({
      status: 'pending-human-review',
      pendingCount: 2,
      candidateCount: 1,
      noCandidateCount: 1,
    });
    expect(result.units[0]).toMatchObject({
      prefixId: 'decision_event',
      choice: 'pending',
      candidateFlowSchemas: ['office-hours'],
      candidateDomains: ['decision-domain'],
      downstreamImpact: {
        domains: ['decision-domain'],
        consumers: ['decision-consumer'],
        intentLinks: ['intent-decision'],
      },
      status: 'needs-human-decision',
    });
    expect(result.units[0].evidenceRequirements).toEqual([
      'source',
      'consumer',
      'flow',
      'decision-rationale',
    ]);
    expect(result.units[1]).toMatchObject({
      prefixId: 'ir_data',
      candidateFlowSchemas: [],
      candidateDomains: [],
      downstreamImpact: { domains: [], consumers: [], intentLinks: [] },
    });
  });

  it('observation이 없으면 빈 report를 반환한다', () => {
    const result = auditDslOwnership(new GraphRegistry());

    expect(result).toEqual({
      observationId: 'OBS-DSL-UNCOVERED',
      status: 'no-uncovered-prefixes',
      pendingCount: 0,
      candidateCount: 0,
      noCandidateCount: 0,
      units: [],
    });
  });
});
