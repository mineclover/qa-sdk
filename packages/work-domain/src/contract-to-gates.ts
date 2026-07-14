// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * Contract → Gates — 계약 문서에서 GateKind를 도출.
 *
 * harness.ts에서 추출 — scope×aspect 매핑 규칙을 독립 테스트 가능하게 분리.
 * definition-service에서 gate 자동 발견에도 재사용 가능.
 */

import type { GateKindId, GateScope } from './gate-kind.js';

/** 문서 요약 — isContractDoc과 deriveGateKinds가 필요한 최소 인터페이스 */
export interface DocSummary {
  readonly scope: string;
  readonly aspect: string;
  readonly tags?: readonly string[];
}

/** 계약 성격 문서인지 판별. interface, constraint scope가 계약을 선언한다. */
export function isContractDoc(doc: DocSummary): boolean {
  return doc.scope === 'interface' || doc.scope === 'constraint';
}

/** 계약 문서에서 필요한 GateKind를 도출한다. */
export function deriveGateKinds(doc: DocSummary): readonly GateKindId[] {
  const kinds: GateKindId[] = [];

  switch (doc.scope) {
    case 'interface':
      switch (doc.aspect) {
        case 'api_contract':
          kinds.push('typecheck', 'api-contract');
          break;
        case 'cli_contract':
          kinds.push('typecheck', 'integration-test');
          break;
        case 'event_contract':
          kinds.push('typecheck', 'unit-test');
          break;
        default:
          kinds.push('typecheck');
      }
      break;

    case 'constraint':
      switch (doc.aspect) {
        case 'tech_constraint':
          kinds.push('unit-test', 'static-analysis');
          break;
        case 'biz_constraint':
          kinds.push('integration-test');
          break;
        case 'infra_constraint':
          kinds.push('build', 'integration-test');
          break;
        default:
          kinds.push('unit-test');
      }
      break;
  }

  // concern tag → 추가 GateKind
  const tags = doc.tags ?? [];
  if (tags.includes('security')) kinds.push('security-audit');
  if (tags.includes('accessibility')) kinds.push('a11y-check');
  if (tags.includes('performance')) kinds.push('perf-benchmark');

  return [...new Set(kinds)];
}

/** GateKindId → GateScope 역매핑 */
export const GATE_KIND_SCOPE_MAP: Record<GateKindId, GateScope> = {
  typecheck: 'static',
  lint: 'static',
  'static-analysis': 'static',
  'unit-test': 'unit',
  'snapshot-test': 'unit',
  'integration-test': 'integration',
  'transaction-test': 'integration',
  'api-contract': 'integration',
  'e2e-test': 'system',
  'visual-check': 'system',
  'perf-benchmark': 'system',
  build: 'build',
  'build-affected': 'build',
  'security-audit': 'audit',
  'a11y-check': 'audit',
  'doc-build': 'audit',
  'license-check': 'audit',
  'eval-benchmark': 'ai',
  'cost-track': 'ai',
};
