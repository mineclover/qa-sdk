// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * claim-operation — 작업 선점/해제 skill.
 *
 * 순수 함수: cascade 영향 분석 + 노드 구성을 반환한다.
 * 그래프 변경 및 store.setMeta는 호출자가 수행.
 */

import type { GraphPort } from 'spec-schema';
import type { ServiceTopologyRegistry } from '../service-topology.js';
import type { ObservationNode } from '../dkg.types.js';

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface ClaimData {
  readonly by: string;
  readonly at: string;
  readonly reason?: string;
}

export interface ClaimImpact {
  readonly owner: string | null;
  readonly consumers: readonly string[];
  readonly domains: readonly string[];
  readonly dslBundles: readonly string[];
  readonly intentLinks: readonly string[];
  readonly affectedPrefixes: readonly string[];
}

export interface ClaimResult {
  readonly verdict: 'ok' | 'blocked';
  readonly reason?: string;
  readonly claim: ClaimData | null;
  readonly impact: ClaimImpact | null;
  readonly summary: string;
}

export interface ReleaseResult {
  readonly verdict: 'ok' | 'blocked';
  readonly reason?: string;
  readonly previousClaim: ClaimData | null;
  readonly observation: ObservationNode | null;
  readonly edges: readonly { type: 'observes'; from: string; to: string }[];
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════
//  Store key convention
// ═══════════════════════════════════════════════════════════════

export function claimKey(targetId: string): string {
  return `claim:${targetId}`;
}

// ═══════════════════════════════════════════════════════════════
//  analyzeClaimImpact
// ═══════════════════════════════════════════════════════════════

export function analyzeClaimImpact(
  graph: GraphPort,
  topo: ServiceTopologyRegistry | null,
  targetId: string,
): ClaimImpact {
  const node = graph.getNode(targetId);
  if (!node) return emptyImpact();

  const impact: {
    owner: string | null;
    consumers: string[];
    domains: string[];
    dslBundles: string[];
    intentLinks: string[];
    affectedPrefixes: string[];
  } = {
    owner: null,
    consumers: [],
    domains: [],
    dslBundles: [],
    intentLinks: [],
    affectedPrefixes: [],
  };

  if (node.kind === 'prefix') {
    if (topo) {
      impact.owner = topo.getOwner(targetId) ?? null;
      impact.consumers = topo.getConsumers(targetId);
    }

    const cascade = graph.cascadeFromPrefix(targetId);
    impact.domains = cascade.domains.map((d) => d.id);

    // DSL bundles (contains 역방향)
    for (const edge of graph.edgesTo(targetId, 'contains')) {
      const parent = graph.getNode(edge.from);
      if (parent?.kind === 'dsl-bundle') impact.dslBundles.push(parent.id);
    }

    // intent-links
    impact.intentLinks = graph.intentLinksFor(targetId).map((l) => l.id);
  } else if (node.kind === 'axis') {
    const affected = graph.cascadeFromAxis(targetId);
    impact.affectedPrefixes = affected.map((a) => a.id);
  }

  return impact;
}

function emptyImpact(): ClaimImpact {
  return {
    owner: null,
    consumers: [],
    domains: [],
    dslBundles: [],
    intentLinks: [],
    affectedPrefixes: [],
  };
}

// ═══════════════════════════════════════════════════════════════
//  prepareClaim
// ═══════════════════════════════════════════════════════════════

export function prepareClaim(
  graph: GraphPort,
  topo: ServiceTopologyRegistry | null,
  targetId: string,
  by: string,
  existingClaim: ClaimData | null,
  reason?: string,
): ClaimResult {
  if (!graph.getNode(targetId)) {
    return {
      verdict: 'blocked',
      reason: `대상 노드 없음: ${targetId}`,
      claim: null,
      impact: null,
      summary: `대상 노드 없음: ${targetId}`,
    };
  }

  if (existingClaim) {
    return {
      verdict: 'blocked',
      reason: `이미 작업중: ${existingClaim.by} (${existingClaim.at})`,
      claim: null,
      impact: null,
      summary: `이미 작업중: ${existingClaim.by} (${existingClaim.at}). 해제 후 재시도.`,
    };
  }

  const now = new Date().toISOString();
  const claim: ClaimData = { by, at: now, ...(reason ? { reason } : {}) };
  const impact = analyzeClaimImpact(graph, topo, targetId);

  return {
    verdict: 'ok',
    claim,
    impact,
    summary: `${targetId} claimed by ${by}`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  prepareRelease
// ═══════════════════════════════════════════════════════════════

export function prepareRelease(
  graph: GraphPort,
  targetId: string,
  existingClaim: ClaimData | null,
  date?: string,
): ReleaseResult {
  if (!existingClaim) {
    return {
      verdict: 'blocked',
      reason: `${targetId}에 대한 claim이 없음`,
      previousClaim: null,
      observation: null,
      edges: [],
      summary: `${targetId}에 대한 claim이 없음`,
    };
  }

  const d = date ?? new Date().toISOString().slice(0, 10);
  const obsId = `OBS-RELEASE-${targetId}-${Date.now().toString(36)}`;

  const observation: ObservationNode = {
    kind: 'observation',
    id: obsId,
    date: d,
    source: 'manual',
    subjects: [targetId],
    finding: `작업 완료 (${existingClaim.by}, ${existingClaim.at} ~ ${d})`,
  };

  return {
    verdict: 'ok',
    previousClaim: existingClaim,
    observation,
    edges: [{ type: 'observes', from: observation.id, to: targetId }],
    summary: `${targetId} released (was: ${existingClaim.by})`,
  };
}
