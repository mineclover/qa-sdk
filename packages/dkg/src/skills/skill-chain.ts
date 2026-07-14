// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * skill chain — 여러 skill을 순차 실행하는 체인.
 *
 * 각 단계가 독립 실행 가능. 중간에 멈추고 인간 개입 가능.
 * 결과를 누적하여 최종 리포트 생성.
 */

import type { Catalog } from '@qa-sdk/core';
import type { GraphPort } from 'spec-schema';
import { safeEntryAdd } from './safe-entry-add.js';
import { auditAllConstraints } from './constraint-check.js';
import { checkAllDomainsHealth } from './domain-health.js';
import { scaffoldDecision } from './decision-scaffold.js';

// ═══════════════════════════════════════════════════════════════
//  Chain Step 결과
// ═══════════════════════════════════════════════════════════════

export interface ChainStepResult {
  readonly step: string;
  readonly status: 'ok' | 'warning' | 'blocked' | 'skipped';
  readonly data: unknown;
  readonly message: string;
}

export interface SkillChainResult {
  readonly steps: readonly ChainStepResult[];
  readonly overallStatus: 'ok' | 'warning' | 'blocked';
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════
//  Entry Add Chain: safe-add → impact → constraint → decision
// ═══════════════════════════════════════════════════════════════

/**
 * entry 추가의 전체 체인을 실행한다.
 *
 * 1. safeEntryAdd — headroom + 존재 여부 + 영향 분석
 * 2. constraint 전체 감사
 * 3. domain 건강 진단
 * 4. decision scaffold (capacity 변경 필요 시)
 *
 * 각 단계의 결과를 누적. blocked이면 이후 단계 스킵.
 */
export function entryAddChain(
  catalog: Catalog,
  graph: GraphPort,
  axisId: string,
  entry: string,
  options?: { date?: string },
): SkillChainResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const steps: ChainStepResult[] = [];

  // Step 1: safe-entry-add
  const safeResult = safeEntryAdd(catalog, graph, { axisId, entry });
  steps.push({
    step: 'safe-entry-add',
    status:
      safeResult.verdict === 'safe'
        ? 'ok'
        : safeResult.verdict === 'already-exists'
          ? 'skipped'
          : safeResult.verdict === 'needs-capacity'
            ? 'warning'
            : 'blocked',
    data: safeResult,
    message: safeResult.summary,
  });

  if (safeResult.verdict === 'already-exists') {
    return finalize(steps, `"${entry}" already exists in ${axisId}`);
  }

  if (safeResult.verdict === 'constraint-violation') {
    return finalize(steps, `Blocked by constraint: ${safeResult.summary}`);
  }

  // Step 2: constraint 전체 감사
  const constraintAudit = auditAllConstraints(graph);
  steps.push({
    step: 'constraint-audit',
    status: constraintAudit.violated > 0 ? 'warning' : 'ok',
    data: {
      total: constraintAudit.total,
      passed: constraintAudit.passed,
      violated: constraintAudit.violated,
    },
    message:
      constraintAudit.violated > 0
        ? `${constraintAudit.violated} constraint violation(s)`
        : `All ${constraintAudit.total} constraints passed`,
  });

  // Step 3: domain 건강 진단
  const domainHealths = checkAllDomainsHealth(graph);
  const criticalDomains = domainHealths.filter((d) => d.overallHealth === 'critical');
  steps.push({
    step: 'domain-health',
    status: criticalDomains.length > 0 ? 'warning' : 'ok',
    data: domainHealths.map((d) => ({
      id: d.domainId,
      health: d.overallHealth,
      issues: d.issues.length,
    })),
    message:
      criticalDomains.length > 0
        ? `${criticalDomains.length} domain(s) critical: ${criticalDomains.map((d) => d.domainId).join(', ')}`
        : `All ${domainHealths.length} domains healthy`,
  });

  // Step 4: decision scaffold (capacity 변경 필요 시)
  if (safeResult.verdict === 'needs-capacity') {
    const decision = scaffoldDecision({
      type: 'capacity',
      id: `DEC-CAPACITY-${axisId}-${date}`,
      date,
      title: `${axisId} capacity 확장 (${entry} 추가를 위해)`,
      params: {
        axis: axisId,
        currentUsed: safeResult.headroom.current,
        currentCapacity: safeResult.headroom.capacity,
        proposedCapacity: safeResult.headroom.capacity * 2,
      },
      rationale: `headroom 0. "${entry}" 추가를 위해 capacity 확장 필요.`,
    });

    steps.push({
      step: 'decision-scaffold',
      status: 'warning',
      data: decision,
      message: `Capacity expansion needed: ${safeResult.headroom.capacity} → ${safeResult.headroom.capacity * 2}. Decision scaffolded.`,
    });
  }

  return finalize(
    steps,
    safeResult.verdict === 'safe'
      ? `"${entry}" can be safely added to ${axisId}. ${safeResult.affectedPrefixes.length} prefix(es) affected.`
      : `"${entry}" needs capacity expansion in ${axisId}.`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  System Health Chain: constraints → domains → coverage
// ═══════════════════════════════════════════════════════════════

/**
 * 시스템 전체 건강 진단 체인.
 */
export function systemHealthChain(graph: GraphPort): SkillChainResult {
  const steps: ChainStepResult[] = [];

  // Step 1: constraint 전체 감사
  const constraintAudit = auditAllConstraints(graph);
  steps.push({
    step: 'constraint-audit',
    status: constraintAudit.violated > 0 ? 'warning' : 'ok',
    data: constraintAudit,
    message: `Constraints: ${constraintAudit.passed}/${constraintAudit.total} passed`,
  });

  // Step 2: domain 건강
  const domainHealths = checkAllDomainsHealth(graph);
  const unhealthy = domainHealths.filter((d) => d.overallHealth !== 'healthy');
  steps.push({
    step: 'domain-health',
    status: unhealthy.length > 0 ? 'warning' : 'ok',
    data: domainHealths,
    message: `Domains: ${domainHealths.length - unhealthy.length}/${domainHealths.length} healthy`,
  });

  // Step 3: observation 요약
  const observations = graph.getNodesByKind('observation');
  const unresolved = observations.filter((o) => !('resolution' in o && o.resolution));
  steps.push({
    step: 'observations',
    status: unresolved.length > 0 ? 'warning' : 'ok',
    data: { total: observations.length, unresolved: unresolved.length },
    message: `Observations: ${observations.length} total, ${unresolved.length} unresolved`,
  });

  return finalize(
    steps,
    `System health: ${steps.filter((s) => s.status === 'ok').length}/${steps.length} checks passed`,
  );
}

function finalize(steps: ChainStepResult[], summary: string): SkillChainResult {
  const hasBlocked = steps.some((s) => s.status === 'blocked');
  const hasWarning = steps.some((s) => s.status === 'warning');

  return {
    steps,
    overallStatus: hasBlocked ? 'blocked' : hasWarning ? 'warning' : 'ok',
    summary,
  };
}
