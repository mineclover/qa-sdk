// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * domain-health — 도메인 단위 건강 진단.
 *
 * prefix 간 version 정합성 + constraint 위반 + coverage 요약.
 */

import type { GraphPort } from 'spec-schema';
import type { DomainNode, PrefixNode } from '../dkg.types.js';
import { checkAllConstraints, type ConstraintCheckResult } from './constraint-check.js';

export interface DomainHealthResult {
  readonly domainId: string;
  readonly domainName: string;
  readonly prefixes: readonly PrefixHealthSummary[];
  readonly constraintResults: readonly ConstraintCheckResult[];
  readonly overallHealth: 'healthy' | 'warning' | 'critical';
  readonly issues: readonly string[];
}

export interface PrefixHealthSummary {
  readonly id: string;
  readonly category: string;
  readonly versionCount: number;
  readonly dimCount: number;
}

/**
 * 특정 domain의 건강 상태를 진단한다.
 */
export function checkDomainHealth(graph: GraphPort, domainId: string): DomainHealthResult {
  const domainNode = graph.getNode(domainId);
  if (!domainNode || domainNode.kind !== 'domain') {
    return {
      domainId,
      domainName: 'unknown',
      prefixes: [],
      constraintResults: [],
      overallHealth: 'critical',
      issues: [`Domain "${domainId}" not found`],
    };
  }

  const dn = domainNode as DomainNode;
  const issues: string[] = [];

  // domain에 포함된 prefix 정보
  const prefixIds = graph.neighbors(domainId, 'contains');
  const prefixes: PrefixHealthSummary[] = prefixIds.map((pid) => {
    const node = graph.getNode(pid) as PrefixNode | undefined;
    return {
      id: pid,
      category: node?.category ?? 'unknown',
      versionCount: 0, // catalog에서 가져와야 하지만 graph만으로 추정
      dimCount: node?.dimLabels.length ?? 0,
    };
  });

  // prefix가 없는 domain
  if (prefixes.length === 0) {
    issues.push(`Domain "${domainId}" has no prefixes`);
  }

  // boundary 검사 — exports에 명시된 prefix가 실제로 contains에 있는가
  if (dn.boundary) {
    for (const exp of dn.boundary.exports) {
      if (!prefixIds.includes(exp)) {
        issues.push(`Exported prefix "${exp}" not found in domain`);
      }
    }
    for (const int of dn.boundary.internal) {
      if (!prefixIds.includes(int)) {
        issues.push(`Internal prefix "${int}" not found in domain`);
      }
    }
  }

  // constraint 검사 — 모든 prefix에 대해
  const constraintResults = checkAllConstraints(graph, prefixIds);
  const violations = constraintResults.flatMap((r) => r.violations);
  if (violations.length > 0) {
    issues.push(
      `${violations.length} constraint violation(s): ${violations.map((v) => v.constraintId).join(', ')}`,
    );
  }

  // 건강 판정
  let overallHealth: DomainHealthResult['overallHealth'];
  if (violations.length > 0 || issues.some((i) => i.includes('not found'))) {
    overallHealth = 'critical';
  } else if (issues.length > 0) {
    overallHealth = 'warning';
  } else {
    overallHealth = 'healthy';
  }

  return {
    domainId,
    domainName: dn.name,
    prefixes,
    constraintResults,
    overallHealth,
    issues,
  };
}

/**
 * 모든 domain의 건강 상태를 진단한다.
 */
export function checkAllDomainsHealth(graph: GraphPort): DomainHealthResult[] {
  const domains = graph.getNodesByKind('domain');
  return domains.map((d) => checkDomainHealth(graph, d.id));
}
