// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import type { GraphRegistry } from '../graph-registry.js';
import type { DkgEdge, DecisionNode, PrefixNode } from '../dkg.types.js';

export type DslOwnershipReviewChoice = 'pending' | 'assign' | 'independent';

export interface DslOwnershipEvidence {
  readonly source?: string;
  readonly consumer?: string;
  readonly flow?: string;
}

export interface RecordDslOwnershipDecisionInput {
  readonly prefixId: string;
  readonly choice: 'assign' | 'independent';
  readonly ownerDslBundleId?: string;
  readonly ownerDomainId?: string;
  readonly rationale: string;
  readonly evidence: DslOwnershipEvidence;
  readonly date?: string;
}

export interface RecordDslOwnershipDecisionResult {
  readonly verdict: 'ok' | 'blocked';
  readonly reason?:
    | 'missing-observation'
    | 'missing-prefix'
    | 'not-pending'
    | 'already-decided'
    | 'incomplete-evidence'
    | 'invalid-choice'
    | 'missing-owner-dsl'
    | 'unexpected-owner-dsl'
    | 'invalid-owner-dsl'
    | 'invalid-owner-domain';
  readonly decision: DecisionNode | null;
  readonly edges: readonly DkgEdge[];
}

export interface DslOwnershipReviewUnit {
  readonly prefixId: string;
  readonly category?: PrefixNode['category'];
  readonly lifecycle?: PrefixNode['lifecycle'];
  /** 자동 귀속을 막고, 사람이 기록한 선택만 반영한다. */
  readonly choice: DslOwnershipReviewChoice;
  readonly decisionId?: string;
  readonly ownerDslBundleId?: string;
  readonly ownerDomainId?: string;
  readonly candidateFlowSchemas: readonly string[];
  readonly candidateDomains: readonly string[];
  readonly currentDslBundles: readonly string[];
  readonly downstreamImpact: {
    readonly domains: readonly string[];
    readonly consumers: readonly string[];
    readonly intentLinks: readonly string[];
  };
  readonly evidenceRequirements: readonly ['source', 'consumer', 'flow', 'decision-rationale'];
  readonly status: 'needs-human-decision' | 'needs-membership-update';
}

export interface DslOwnershipReviewReport {
  readonly observationId: 'OBS-DSL-UNCOVERED';
  readonly status: 'pending-human-review' | 'no-uncovered-prefixes';
  readonly pendingCount: number;
  /** 검토 결정이 기록된 prefix 수. observation 해소와는 별개다. */
  readonly decidedCount: number;
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

  const ownershipDecisions = new Map<string, DecisionNode>();
  for (const decision of graph.getNodesByKind('decision')) {
    const metadata = decision.metadata;
    if (metadata?.decisionType !== 'dsl-ownership') continue;
    const prefixId = typeof metadata.prefixId === 'string' ? metadata.prefixId : undefined;
    if (prefixId) ownershipDecisions.set(prefixId, decision);
  }

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

    const decision = ownershipDecisions.get(prefixId);
    const decisionMetadata = decision?.metadata;
    const choice =
      decisionMetadata?.choice === 'assign' || decisionMetadata?.choice === 'independent'
        ? decisionMetadata.choice
        : 'pending';
    const ownerDslBundleId =
      typeof decisionMetadata?.ownerDslBundleId === 'string'
        ? decisionMetadata.ownerDslBundleId
        : undefined;
    const ownerDomainId =
      typeof decisionMetadata?.ownerDomainId === 'string'
        ? decisionMetadata.ownerDomainId
        : undefined;

    // A deliberate independent decision closes the ownership review for this prefix,
    // but does not mutate or resolve OBS-DSL-UNCOVERED itself.
    if (choice === 'independent') return [];

    // An assign decision is complete only after the chosen DSL bundle actually
    // contains the prefix. The decision command never mutates bundle membership.
    const ownerDsl = ownerDslBundleId ? graph.getNode(ownerDslBundleId) : undefined;
    const ownerDslContainsPrefix =
      ownerDsl?.kind === 'dsl-bundle' && ownerDsl.memberPrefixes.includes(prefixId);
    if (
      choice === 'assign' &&
      ownerDslBundleId &&
      currentDslBundles.includes(ownerDslBundleId) &&
      ownerDslContainsPrefix
    ) {
      return [];
    }

    return [
      {
        prefixId,
        category: prefix.category,
        lifecycle: prefix.lifecycle,
        choice,
        ...(decision ? { decisionId: decision.id } : {}),
        ...(ownerDslBundleId ? { ownerDslBundleId } : {}),
        ...(ownerDomainId ? { ownerDomainId } : {}),
        candidateFlowSchemas,
        candidateDomains,
        currentDslBundles,
        downstreamImpact: { domains, consumers, intentLinks },
        evidenceRequirements: ['source', 'consumer', 'flow', 'decision-rationale'],
        status: choice === 'assign' ? 'needs-membership-update' : 'needs-human-decision',
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
    decidedCount: prefixIds.filter((prefixId) => ownershipDecisions.has(prefixId)).length,
    candidateCount,
    noCandidateCount: units.length - candidateCount,
    units,
  };
}

/**
 * 사람이 작성한 DSL ownership 판단을 검증하고 DecisionNode/엣지를 만든다.
 *
 * 이 함수는 graph/store를 mutate하지 않는다. 호출자가 결과를 저장해야 하며,
 * bundle membership 변경이나 OBS-DSL-UNCOVERED 해소도 소유하지 않는다.
 */
export function recordDslOwnershipDecision(
  graph: GraphRegistry,
  input: RecordDslOwnershipDecisionInput,
): RecordDslOwnershipDecisionResult {
  const observation = graph.getNode('OBS-DSL-UNCOVERED');
  if (!observation || observation.kind !== 'observation') {
    return blocked('missing-observation');
  }

  const prefix = graph.getNode(input.prefixId);
  if (!prefix || prefix.kind !== 'prefix') return blocked('missing-prefix');
  if (!observation.subjects.includes(input.prefixId)) return blocked('not-pending');

  const hasExistingDecision = graph.getNodesByKind('decision').some((decision) => {
    const metadata = decision.metadata;
    return metadata?.decisionType === 'dsl-ownership' && metadata.prefixId === input.prefixId;
  });
  if (hasExistingDecision) return blocked('already-decided');

  const report = auditDslOwnership(graph);
  if (!report.units.some((unit) => unit.prefixId === input.prefixId)) {
    return blocked('already-decided');
  }

  if (input.choice !== 'assign' && input.choice !== 'independent') {
    return blocked('invalid-choice');
  }

  const evidence = {
    source: input.evidence.source?.trim() ?? '',
    consumer: input.evidence.consumer?.trim() ?? '',
    flow: input.evidence.flow?.trim() ?? '',
  };
  if (!input.rationale.trim() || Object.values(evidence).some((value) => value.length === 0)) {
    return blocked('incomplete-evidence');
  }

  if (input.choice === 'assign') {
    if (!input.ownerDslBundleId) return blocked('missing-owner-dsl');
    const ownerDsl = graph.getNode(input.ownerDslBundleId);
    if (!ownerDsl || ownerDsl.kind !== 'dsl-bundle') return blocked('invalid-owner-dsl');
  } else if (input.ownerDslBundleId) {
    return blocked('unexpected-owner-dsl');
  }

  if (input.ownerDomainId) {
    const ownerDomain = graph.getNode(input.ownerDomainId);
    if (!ownerDomain || ownerDomain.kind !== 'domain') return blocked('invalid-owner-domain');
  }

  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const decisionId = `DEC-DSL-OWNERSHIP-${input.prefixId}-${Date.now().toString(36)}`;
  const decision: DecisionNode = {
    kind: 'decision',
    id: decisionId,
    date,
    title:
      input.choice === 'assign'
        ? `${input.prefixId} DSL ownership 귀속`
        : `${input.prefixId} DSL 독립 사용`,
    context: `prefix ${input.prefixId}의 DSL ownership 판단 (${input.choice})`,
    rationale: input.rationale.trim(),
    alternatives: ['후속 근거가 바뀌면 ownership decision을 supersede한다.'],
    reversalConditions: ['새 source/consumer/flow evidence가 현재 판단과 충돌할 때'],
    lifecycle: 'active',
    metadata: {
      decisionType: 'dsl-ownership',
      prefixId: input.prefixId,
      choice: input.choice,
      ...(input.ownerDslBundleId ? { ownerDslBundleId: input.ownerDslBundleId } : {}),
      ...(input.ownerDomainId ? { ownerDomainId: input.ownerDomainId } : {}),
      evidence,
    },
  };

  const edges: DkgEdge[] = [
    { type: 'governs', from: decision.id, to: input.prefixId },
    { type: 'prompts', from: observation.id, to: decision.id },
  ];
  return { verdict: 'ok', decision, edges };
}

function blocked(reason: RecordDslOwnershipDecisionResult['reason']): RecordDslOwnershipDecisionResult {
  return { verdict: 'blocked', reason, decision: null, edges: [] };
}
