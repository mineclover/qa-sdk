// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * Scope Nesting → D3 데이터 모델
 *
 * 기존 pipe-svg의 D3GraphData 패턴을 따라
 * scope를 중첩 컨테이너 + 계약을 엣지로 변환.
 */

import type { ScopeNesting, NestingValidation, DescentPath } from '@qa-sdk/core';
import type { MountSnapshot } from '@qa-sdk/core';
import type { TimingValidation } from '@qa-sdk/core';

// ── D3 데이터 모델 ───────────────────────────────────

export interface D3ScopeNode {
  id: string;
  label: string;
  depth: number;
  /** 제공하는 계약 */
  provides: string[];
  /** 소비하는 계약 (optional은 ? 접미사) */
  consumes: string[];
  /** 패싯 역할 */
  facets: string[];
  /** 이 scope에서 실행되는 pipe */
  pipes: string[];
  /** 레이아웃 */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 검증 상태 */
  status: 'valid' | 'warning' | 'error';
  /** 활성 계약 (mount snapshot) */
  activeContracts: string[];
}

export interface D3ContractEdge {
  contractId: string;
  source: string;
  target: string;
  type: 'state' | 'logging' | 'persist' | 'adapter' | 'custom';
  /** optional consume */
  optional: boolean;
  /** timing: pending 구간 있는지 */
  hasPendingPhase: boolean;
}

export interface D3ScopeGraph {
  nodes: D3ScopeNode[];
  edges: D3ContractEdge[];
  /** 전체 SVG 크기 */
  width: number;
  height: number;
}

// ── 변환 함수 ─────────────────────────────────────────

const SCOPE_WIDTH = 280;
const SCOPE_HEIGHT = 120;
const SCOPE_GAP = 40;
const NEST_PADDING = 20;

/**
 * ScopeNesting → D3 데이터.
 * 중첩 레이아웃: 외부 scope가 내부를 감싸는 구조.
 */
export function scopeNestingToD3(
  nesting: ScopeNesting,
  validation?: NestingValidation,
  snapshots?: MountSnapshot[],
  timing?: TimingValidation,
): D3ScopeGraph {
  const { scopes } = nesting;
  const n = scopes.length;

  // issue → scope 상태 맵
  const scopeStatus = new Map<string, 'valid' | 'warning' | 'error'>();
  if (validation) {
    for (const issue of validation.issues) {
      if (!issue.scopeId) continue;
      const current = scopeStatus.get(issue.scopeId) ?? 'valid';
      if (issue.severity === 'error') {
        scopeStatus.set(issue.scopeId, 'error');
      } else if (current !== 'error') {
        scopeStatus.set(issue.scopeId, 'warning');
      }
    }
  }

  // 중첩 레이아웃 계산 (외부→내부)
  const totalWidth = SCOPE_WIDTH + (n - 1) * NEST_PADDING * 2;
  const totalHeight = SCOPE_HEIGHT * n + SCOPE_GAP * (n - 1) + (n - 1) * NEST_PADDING * 2;

  const nodes: D3ScopeNode[] = scopes.map((scope, i) => {
    const snap = snapshots?.[i];
    return {
      id: scope.scopeId,
      label: scope.scopeId,
      depth: i,
      provides: scope.provides.map((c) => c.contractId),
      consumes: scope.consumes.map((c) => c.contractId + (c.required === false ? '?' : '')),
      facets: scope.facets ?? [],
      pipes: snap?.pipes ?? [],
      x: NEST_PADDING * i,
      y: NEST_PADDING * i + (SCOPE_HEIGHT + SCOPE_GAP) * i,
      width: SCOPE_WIDTH + (n - 1 - i) * NEST_PADDING * 2,
      height: SCOPE_HEIGHT,
      status: scopeStatus.get(scope.scopeId) ?? 'valid',
      activeContracts: snap?.activeContracts ?? [],
    };
  });

  // 계약 하향 엣지
  const edges: D3ContractEdge[] = [];
  if (validation) {
    // readyAfter 맵
    const pendingContracts = new Set(
      timing?.readinessTimeline?.filter((r) => r.readyAtStep > 0).map((r) => r.contractId) ?? [],
    );

    for (const path of validation.descentPaths) {
      for (const consumer of path.consumedBy) {
        const consumerScope = scopes.find((s) => s.scopeId === consumer);
        const contractDef = scopes
          .find((s) => s.scopeId === path.providedBy)
          ?.provides.find((c) => c.contractId === path.contractId);
        const isOptional =
          consumerScope?.consumes.some(
            (c) => c.contractId === path.contractId && c.required === false,
          ) ?? false;

        edges.push({
          contractId: path.contractId,
          source: path.providedBy,
          target: consumer,
          type: (contractDef?.type ?? 'custom') as D3ContractEdge['type'],
          optional: isOptional,
          hasPendingPhase: pendingContracts.has(path.contractId),
        });
      }
    }
  }

  return {
    nodes,
    edges,
    width: totalWidth + NEST_PADDING * 2,
    height: totalHeight + NEST_PADDING * 2,
  };
}
