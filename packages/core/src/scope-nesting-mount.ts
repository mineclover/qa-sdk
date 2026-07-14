// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Mount Flow — scope↔pipe 브릿지
 *
 * scope 마운트 순서에 따른 계약 가용성 타임라인을 계산하고,
 * pipe의 계약 의존이 마운트 시점에 충족되는지 검증한다.
 */

import type { ScopeNesting, SimulationGuards } from './scope-nesting.js';
import { resolveGuards } from './scope-nesting.js';
import type { PipeGraph } from './types/pipe-spec.js';

// ── 타입 ──────────────────────────────────────────────

export interface ScopeContractRef {
  contractId: string;
  /** 필수 여부 (기본: true). false이면 미활성 시 warning만 */
  required?: boolean;
}

export interface ScopePipeBinding {
  scopeId: string;
  /** string이면 required: true */
  scopeContracts: Array<string | ScopeContractRef>;
}

export interface MountFlowBinding {
  nesting: ScopeNesting;
  graph: PipeGraph;
  bindings: Record<string, ScopePipeBinding>;
}

export interface MountSnapshot {
  depth: number;
  scopeId: string;
  activeContracts: string[];
  pipes: string[];
}

export type MountFlowIssueCode =
  | 'unbound-pipe'
  | 'contract-unavailable'
  | 'scope-not-found'
  | 'pipe-not-found';

export interface MountFlowIssue {
  severity: 'error' | 'warning';
  code: MountFlowIssueCode;
  pipeId: string;
  scopeId: string;
  contractId?: string;
  message: string;
}

export interface MountFlowValidation {
  valid: boolean;
  issues: MountFlowIssue[];
  snapshots: MountSnapshot[];
}

// ── 검증 함수 ─────────────────────────────────────────

/** pipe의 scope 계약 의존이 마운트 시점에 충족되는지 확인 */
export function validateMountFlow(
  binding: MountFlowBinding,
  guards?: SimulationGuards,
): MountFlowValidation {
  const issues: MountFlowIssue[] = [];
  const g = resolveGuards(guards);
  const { nesting, graph, bindings } = binding;
  const { scopes } = nesting;

  // depth별 활성 계약 누적
  const activeByDepth: string[][] = [];
  let accumulated: string[] = [];
  for (const scope of scopes) {
    const newContracts = scope.provides
      .filter((c) => g.isEncodable(c.contractId))
      .map((c) => c.contractId);
    accumulated = [...accumulated, ...newContracts];
    activeByDepth.push([...accumulated]);
  }

  const scopeDepthMap = new Map(scopes.map((s, i) => [s.scopeId, i]));
  const pipeByScopeId = new Map<string, string[]>();
  const pipeIds = new Set(graph.pipes.map((p) => p.pipeId));

  for (const [pipeId, scopeBinding] of Object.entries(bindings)) {
    if (!pipeIds.has(pipeId)) {
      issues.push({
        severity: 'error',
        code: 'pipe-not-found',
        pipeId,
        scopeId: scopeBinding.scopeId,
        message: `바인딩의 pipe "${pipeId}"가 graph에 없음`,
      });
      continue;
    }

    const depth = scopeDepthMap.get(scopeBinding.scopeId);
    if (depth === undefined) {
      issues.push({
        severity: 'error',
        code: 'scope-not-found',
        pipeId,
        scopeId: scopeBinding.scopeId,
        message: `바인딩의 scope "${scopeBinding.scopeId}"가 nesting에 없음`,
      });
      continue;
    }

    const pipes = pipeByScopeId.get(scopeBinding.scopeId) ?? [];
    pipes.push(pipeId);
    pipeByScopeId.set(scopeBinding.scopeId, pipes);

    const active = activeByDepth[depth];
    for (const ref of scopeBinding.scopeContracts) {
      const contractId = typeof ref === 'string' ? ref : ref.contractId;
      const isOptional = typeof ref === 'string' ? false : ref.required === false;

      if (!active.includes(contractId)) {
        issues.push({
          severity: isOptional ? 'warning' : 'error',
          code: 'contract-unavailable',
          pipeId,
          scopeId: scopeBinding.scopeId,
          contractId,
          message: `pipe "${pipeId}"가 소비하는 ${isOptional ? '선택적 ' : ''}계약 "${contractId}"이 scope "${scopeBinding.scopeId}"(depth ${depth}) 마운트 시점에 미활성`,
        });
      }
    }
  }

  for (const pipe of graph.pipes) {
    if (!(pipe.pipeId in bindings)) {
      issues.push({
        severity: 'warning',
        code: 'unbound-pipe',
        pipeId: pipe.pipeId,
        scopeId: '',
        message: `pipe "${pipe.pipeId}"에 scope binding 없음`,
      });
    }
  }

  const snapshots: MountSnapshot[] = scopes.map((scope, i) => ({
    depth: i,
    scopeId: scope.scopeId,
    activeContracts: activeByDepth[i],
    pipes: pipeByScopeId.get(scope.scopeId) ?? [],
  }));

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    snapshots,
  };
}
