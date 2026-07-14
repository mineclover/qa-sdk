// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * 종단 cascade 영향 분석.
 *
 * weighted-index diff → DKG 그래프 순회 → 최종 영향 범위.
 */

import type { GraphPort } from 'spec-schema';
import type {
  ImpactAnalysisInput,
  ImpactAnalysisResult,
  AffectedPrefix,
  AffectedDomain,
  AffectedConsumer,
  ConstraintViolation,
  BrokenIntentLink,
} from '../dkg.types.js';

export function analyzeImpact(graph: GraphPort, input: ImpactAnalysisInput): ImpactAnalysisResult {
  const affectedPrefixes: AffectedPrefix[] = [];
  const allAffectedPrefixIds: string[] = [];

  // 1. axis 변경 → composes + references cascade
  if (input.target.axis) {
    const cascade = graph.cascadeFromAxis(input.target.axis);
    for (const c of cascade) {
      affectedPrefixes.push(c);
      allAffectedPrefixIds.push(c.id);
    }
  }

  // prefix 직접 변경
  if (input.target.prefix && !allAffectedPrefixIds.includes(input.target.prefix)) {
    allAffectedPrefixIds.push(input.target.prefix);
    affectedPrefixes.push({ id: input.target.prefix, reason: 'composes', distance: 0 });
  }

  // 2. 영향받는 prefix → domain + consumer cascade
  const allDomains: AffectedDomain[] = [];
  const allConsumers: AffectedConsumer[] = [];
  const seenDomains = new Set<string>();
  const seenConsumers = new Set<string>();

  for (const pId of allAffectedPrefixIds) {
    const { domains, consumers } = graph.cascadeFromPrefix(pId);

    for (const d of domains) {
      if (!seenDomains.has(d.id)) {
        seenDomains.add(d.id);
        allDomains.push(d);
      }
    }

    for (const c of consumers) {
      if (!seenConsumers.has(c.id)) {
        seenConsumers.add(c.id);
        allConsumers.push(c);
      }
    }
  }

  // 3. constraint 검사
  const constraintViolations: ConstraintViolation[] = [];

  if (input.target.axis) {
    const axisConstraints = graph.activeConstraints(input.target.axis);
    constraintViolations.push(...axisConstraints);
  }
  for (const pId of allAffectedPrefixIds) {
    const prefixConstraints = graph.activeConstraints(pId);
    constraintViolations.push(...prefixConstraints);
  }

  // 4. intent-link 검사
  const brokenIntentLinks: BrokenIntentLink[] = [];

  for (const pId of allAffectedPrefixIds) {
    const links = graph.intentLinksFor(pId);
    for (const link of links) {
      if (link.invariant) {
        brokenIntentLinks.push({ id: link.id, invariant: link.invariant });
      }
    }
  }

  // 5. stride-break / migration 판정
  const strideBreak =
    input.type === 'capacity-changed' || input.type === 'dim-added' || input.type === 'ref-changed';

  const migrationRequired = strideBreak;
  const autoMigratable = input.type === 'capacity-changed' || input.type === 'entry-added';

  return {
    strideBreak,
    affectedPrefixes,
    affectedDomains: allDomains,
    affectedConsumers: allConsumers,
    migrationRequired,
    autoMigratable,
    constraintViolations,
    brokenIntentLinks,
  };
}
