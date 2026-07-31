// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import type { GraphRegistry } from '../graph-registry.js';
import type { PrefixNode } from '../dkg.types.js';

export type DslOwnershipReviewChoice = 'pending';

export interface DslOwnershipReviewUnit {
  readonly prefixId: string;
  readonly category?: PrefixNode['category'];
  readonly lifecycle?: PrefixNode['lifecycle'];
  /** 자동 귀속을 막기 위해 항상 pending으로 시작한다. */
  readonly choice: DslOwnershipReviewChoice;
  readonly candidateFlowSchemas: readonly string[];
  readonly candidateDomains: readonly string[];
  readonly currentDslBundles: readonly string[];
  readonly downstreamImpact: {
    readonly domains: readonly string[];
    readonly consumers: readonly string[];
    readonly intentLinks: readonly string[];
  };
  readonly evidenceRequirements: readonly ['source', 'consumer', 'flow', 'decision-rationale'];
  readonly status: 'needs-human-decision';
}

export interface DslOwnershipReviewReport {
  readonly observationId: 'OBS-DSL-UNCOVERED';
  readonly status: 'pending-human-review' | 'no-uncovered-prefixes';
  readonly pendingCount: number;
  readonly candidateCount: number;
  readonly noCandidateCount: number;
  readonly units: readonly DslOwnershipReviewUnit[];
}

/**
 * OBS-DSL-UNCOVERED를 사람이 검토할 수 있는 prefix별 decision unit으로 펼친다.
 *
 * 이 함수는 DSL/domain을 자동으로 소유자로 지정하거나 observation을 해소하지 않는다.
 * 후보와 downstream 영향을 정리하고, source/consumer/flow/rationale 근거가 채워질
 * 때까지 `needs-human-decision` 상태를 유지한다.
 */
export function auditDslOwnership(graph: GraphRegistry): DslOwnershipReviewReport {
  const observation = graph.getNode('OBS-DSL-UNCOVERED');
  const prefixIds = observation?.kind === 'observation' ? observation.subjects : [];

  const units = prefixIds.flatMap((prefixId): DslOwnershipReviewUnit[] => {
    const prefix = graph.getNode(prefixId);
    if (!prefix || prefix.kind !== 'prefix') return [];

    const candidateFlowSchemas = graph
      .reverseNeighbors(prefixId, 'observes')
      .filter((id) => graph.getNode(id)?.kind === 'flow-schema')
      .sort();
    const candidateDomains = graph
      .reverseNeighbors(prefixId, 'contains')
      .filter((id) => graph.getNode(id)?.kind === 'domain')
      .sort();
    const currentDslBundles = graph
      .reverseNeighbors(prefixId, 'contains')
      .filter((id) => graph.getNode(id)?.kind === 'dsl-bundle')
      .sort();
    const cascade = graph.cascadeFromPrefix(prefixId);
    const domains = [...new Set(cascade.domains.map((domain) => domain.id))].sort();
    const consumers = [...new Set(cascade.consumers.map((consumer) => consumer.id))].sort();
    const intentLinks = graph
      .intentLinksFor(prefixId)
      .map((link) => link.id)
      .sort();

    return [
      {
        prefixId,
        category: prefix.category,
        lifecycle: prefix.lifecycle,
        choice: 'pending',
        candidateFlowSchemas,
        candidateDomains,
        currentDslBundles,
        downstreamImpact: { domains, consumers, intentLinks },
        evidenceRequirements: ['source', 'consumer', 'flow', 'decision-rationale'],
        status: 'needs-human-decision',
      },
    ];
  });

  const candidateCount = units.filter(
    (unit) => unit.candidateFlowSchemas.length > 0 || unit.candidateDomains.length > 0,
  ).length;

  return {
    observationId: 'OBS-DSL-UNCOVERED',
    status: units.length > 0 ? 'pending-human-review' : 'no-uncovered-prefixes',
    pendingCount: units.length,
    candidateCount,
    noCandidateCount: units.length - candidateCount,
    units,
  };
}
