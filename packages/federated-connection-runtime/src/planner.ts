// @def.doc federated-connection-runtime

import { createHash } from 'node:crypto';
import {
  connectionRefKey,
  endpointKey,
  sourceRefKey,
  type ConnectionEndpoint,
  type ConnectionMapping,
  type ConnectionSnapshot,
  type SourceRef,
} from 'federated-connection';
import {
  type CandidateDisposition,
  type ImpactCandidate,
  type ImpactKind,
  type ImpactPlan,
  type ImpactRisk,
  type PropagationAction,
  type PropagationPolicy,
  type StoredSourceObservation,
} from './runtime-contract.js';

const DEFAULT_MAX_DEPTH = 3;

function stableId(prefix: string, value: unknown): string {
  const digest = createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
  return `${prefix}-${digest}`;
}

function riskFor(changeKind: StoredSourceObservation['change']['kind'], depth: number): ImpactRisk {
  if (changeKind === 'deleted') return depth === 0 ? 'critical' : 'high';
  if (changeKind === 'restored') return depth === 0 ? 'high' : 'medium';
  if (changeKind === 'updated') return depth === 0 ? 'medium' : 'high';
  return depth === 0 ? 'low' : 'medium';
}

function riskRank(risk: ImpactRisk): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[risk];
}

function dispositionFor(policy: PropagationPolicy, risk: ImpactRisk): CandidateDisposition {
  if (policy.mode === 'blocked') return 'blocked';
  if (policy.mode === 'notify_only' || policy.mode === 'validate_only') return 'notify_only';
  if (riskRank(risk) >= riskRank('critical')) return 'blocked';
  return 'proposed';
}

function activeMappingsForSource(
  snapshot: ConnectionSnapshot,
  source: SourceRef,
): ConnectionMapping[] {
  return snapshot.mappings.filter(
    (mapping) =>
      mapping.status === 'active' && sourceRefKey(mapping.source) === sourceRefKey(source),
  );
}

function activeMappingsForTarget(
  snapshot: ConnectionSnapshot,
  endpoint: ConnectionEndpoint,
): ConnectionMapping[] {
  if (endpoint.kind !== 'connection') return [];
  return snapshot.mappings.filter(
    (mapping) =>
      mapping.status === 'active' &&
      connectionRefKey(mapping.target) === connectionRefKey(endpoint.ref),
  );
}

function neighbours(
  snapshot: ConnectionSnapshot,
  endpoint: ConnectionEndpoint,
): Array<{ endpoint: ConnectionEndpoint; relationIds: string[]; reason: string }> {
  const result: Array<{ endpoint: ConnectionEndpoint; relationIds: string[]; reason: string }> = [];

  if (endpoint.kind === 'source') {
    for (const mapping of activeMappingsForSource(snapshot, endpoint.ref)) {
      result.push({
        endpoint: { kind: 'connection', ref: { ...mapping.target } },
        relationIds: [],
        reason: `active mapping ${mapping.id}`,
      });
    }
  } else {
    for (const mapping of activeMappingsForTarget(snapshot, endpoint)) {
      result.push({
        endpoint: { kind: 'source', ref: { ...mapping.source } },
        relationIds: [],
        reason: `reverse mapping ${mapping.id}`,
      });
    }
  }

  for (const relation of snapshot.relations) {
    if (endpointKey(relation.source) !== endpointKey(endpoint)) continue;
    result.push({
      endpoint: relation.target,
      relationIds: [relation.id],
      reason: `typed relation ${relation.id}:${relation.relationType}`,
    });
  }

  return result;
}

function candidateFor(
  source: SourceRef,
  target: ConnectionEndpoint,
  depth: number,
  relationIds: readonly string[],
  reason: string,
  policy: PropagationPolicy,
  changeKind: StoredSourceObservation['change']['kind'],
): ImpactCandidate {
  const kind: ImpactKind = depth === 1 ? 'direct' : 'indirect';
  const risk = riskFor(changeKind, depth - 1);
  return {
    id: stableId('impact', { source, target, depth, relationIds }),
    kind,
    depth: depth - 1,
    target,
    relationIds: [...relationIds],
    risk,
    disposition: dispositionFor(policy, risk),
    reason,
  };
}

function buildAction(source: SourceRef, candidate: ImpactCandidate): PropagationAction {
  return {
    id: stableId('action', { source, candidate: candidate.id }),
    kind: 'reconcile_target',
    target: candidate.target,
    sourcePrecondition: { ...source },
    relationIds: [...candidate.relationIds],
    reason: candidate.reason,
  };
}

export function validatePropagationPolicy(policy: PropagationPolicy): PropagationPolicy {
  if (policy.version.length === 0) throw new Error('policy.version must be a non-empty string');
  if (
    policy.maxDepth !== undefined &&
    (!Number.isInteger(policy.maxDepth) || policy.maxDepth < 1)
  ) {
    throw new Error('policy.maxDepth must be a positive integer');
  }
  return { ...policy };
}

export function createImpactPlan(
  observation: StoredSourceObservation,
  snapshot: ConnectionSnapshot,
  policy: PropagationPolicy,
  now: string,
  planId: string,
): ImpactPlan {
  validatePropagationPolicy(policy);
  const maxDepth = policy.maxDepth ?? DEFAULT_MAX_DEPTH;
  const start: ConnectionEndpoint = { kind: 'source', ref: { ...observation.source } };
  const startMappings = activeMappingsForSource(snapshot, observation.source);
  const candidates: ImpactCandidate[] = [];
  const visited = new Set<string>([endpointKey(start)]);
  const queue: Array<{
    endpoint: ConnectionEndpoint;
    depth: number;
    relationIds: string[];
    reason: string;
  }> = [{ endpoint: start, depth: 0, relationIds: [], reason: 'source observation' }];

  if (startMappings.length === 0) {
    candidates.push({
      id: stableId('impact', { source: observation.source, missing: true }),
      kind: 'direct',
      depth: 0,
      target: start,
      relationIds: [],
      risk: 'high',
      disposition: 'blocked',
      reason: 'no active mapping exists for the observed source revision',
    });
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    for (const next of neighbours(snapshot, current.endpoint)) {
      const key = endpointKey(next.endpoint);
      if (visited.has(key)) continue;
      visited.add(key);

      const relationIds = [...current.relationIds, ...next.relationIds];
      const candidate = candidateFor(
        observation.source,
        next.endpoint,
        current.depth + 1,
        relationIds,
        next.reason,
        policy,
        observation.change.kind,
      );
      candidates.push(candidate);
      queue.push({
        endpoint: next.endpoint,
        depth: current.depth + 1,
        relationIds,
        reason: next.reason,
      });
    }
  }

  const actions = candidates
    .filter((candidate) => candidate.disposition === 'proposed')
    .map((candidate) => buildAction(observation.source, candidate));
  const approvalRequired =
    policy.requireApproval === true ||
    policy.mode !== 'automatic' ||
    candidates.some((candidate) => candidate.risk !== 'low');

  return {
    id: planId,
    source: { ...observation.source },
    observation,
    policy: { ...policy },
    graphSnapshot: snapshot,
    candidates,
    actions,
    approvalRequired,
    status: 'proposed',
    createdAt: now,
    updatedAt: now,
  };
}
