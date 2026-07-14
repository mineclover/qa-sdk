// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Scope Lifecycle 패턴 — 비활성화 영향 분석 파이프라인
 *
 * 3단계 파이프라인으로 scope 비활성화의 영향을 분석한다:
 *   [1] snapshotProviders  → provider 스냅샷 (범용)
 *   [2] traceContracts     → 계약별 소비자 추적 (범용)
 *   [3] classifyImpact     → affected/unaffected 분류 (deactivation 전용)
 *
 * 각 단계가 독립 사용·관측 가능하며, 최종 결과에 데이터 계보를 포함한다.
 */

import type { ScopeNesting, SimulationGuards } from './scope-nesting.js';
import { resolveGuards, buildProviderMap } from './scope-nesting.js';

// ── 타입 ──────────────────────────────────────────────

/** Stage 1 출력 — provider 스냅샷 */
export interface ProviderSnapshot {
  /** contractId → 최종 provider (override 해소 후) */
  providers: Record<string, { scopeId: string; depth: number }>;
  /** guard에 의해 이미 비활성인 계약 목록 */
  guardFiltered: string[];
}

/** Stage 2 출력 — 계약별 소비 추적 */
export interface ContractTrace {
  contractId: string;
  provider: { scopeId: string; depth: number };
  consumers: Array<{ scopeId: string; depth: number; required: boolean }>;
  /** 대상 scope 제거 후에도 대체 provider 존재 여부 */
  hasAlternative: boolean;
}

/** Stage 3 출력 — 최종 영향 분류 + 계보 */
export interface DeactivationImpact {
  deactivated: string;
  affected: Array<{ scopeId: string; lostContracts: string[] }>;
  unaffected: string[];
  /** 판단 근거 — 계약별 추적 데이터 */
  traces: ContractTrace[];
  /** guard로 제외된 계약 (노이즈 제거 근거) */
  guardFiltered: string[];
}

// ── Stage 1: snapshotProviders (범용) ─────────────────

/**
 * nesting의 provider 구조를 평탄화한다.
 * override 해소 + guard 필터링을 적용하여 최종 provider 맵을 반환한다.
 */
export function snapshotProviders(
  nesting: ScopeNesting,
  guards?: SimulationGuards,
): ProviderSnapshot {
  const g = resolveGuards(guards);

  // guard로 필터된 계약 수집
  const guardFiltered: string[] = [];
  for (const scope of nesting.scopes) {
    for (const contract of scope.provides) {
      if (!g.isEncodable(contract.contractId)) {
        guardFiltered.push(contract.contractId);
      }
    }
  }

  // buildProviderMap 재사용 (issues 없이 순수 매핑만)
  const providerMap = buildProviderMap(nesting.scopes, g.isEncodable);
  const providers: Record<string, { scopeId: string; depth: number }> = {};
  for (const [contractId, entry] of providerMap) {
    providers[contractId] = entry;
  }

  return { providers, guardFiltered };
}

// ── Stage 2: traceContracts (범용) ────────────────────

/**
 * 특정 scope가 제공하는 계약의 소비자를 추적한다.
 * 대상 scope가 최종 provider인 계약만 추적하며, 대체 provider 존재 여부를 판정한다.
 */
export function traceContracts(
  nesting: ScopeNesting,
  snapshot: ProviderSnapshot,
  scopeId: string,
): ContractTrace[] {
  const targetIdx = nesting.scopes.findIndex((s) => s.scopeId === scopeId);
  if (targetIdx === -1) return [];

  const traces: ContractTrace[] = [];

  for (const [contractId, provider] of Object.entries(snapshot.providers)) {
    // 대상 scope가 최종 provider인 계약만
    if (provider.scopeId !== scopeId) continue;

    // 소비자 수집 + 대체 provider 탐지 (단일 순회)
    const consumers: ContractTrace['consumers'] = [];
    let hasAlternative = false;
    for (let i = 0; i < nesting.scopes.length; i++) {
      if (i === targetIdx) continue;
      const scope = nesting.scopes[i];
      if (!hasAlternative && scope.provides.some((p) => p.contractId === contractId)) {
        hasAlternative = true;
      }
      for (const consumed of scope.consumes) {
        if (consumed.contractId === contractId) {
          consumers.push({
            scopeId: scope.scopeId,
            depth: i,
            required: consumed.required !== false,
          });
        }
      }
    }

    traces.push({ contractId, provider, consumers, hasAlternative });
  }

  return traces;
}

// ── Stage 3: classifyImpact (deactivation 전용) ──────

/**
 * trace 결과를 affected/unaffected로 분류한다.
 * hasAlternative === false && consumers 존재 → affected.
 */
export function classifyImpact(
  nesting: ScopeNesting,
  scopeId: string,
  traces: ContractTrace[],
  snapshot: ProviderSnapshot,
): DeactivationImpact {
  // scopeId별 lost contracts 집계
  const lostMap = new Map<string, string[]>();

  for (const trace of traces) {
    if (trace.hasAlternative) continue;
    for (const consumer of trace.consumers) {
      const list = lostMap.get(consumer.scopeId) ?? [];
      list.push(trace.contractId);
      lostMap.set(consumer.scopeId, list);
    }
  }

  const affected: DeactivationImpact['affected'] = [];
  const unaffected: string[] = [];

  for (const scope of nesting.scopes) {
    if (scope.scopeId === scopeId) continue; // 비활성 대상 자신 제외
    const lost = lostMap.get(scope.scopeId);
    if (lost && lost.length > 0) {
      affected.push({ scopeId: scope.scopeId, lostContracts: lost });
    } else {
      unaffected.push(scope.scopeId);
    }
  }

  return {
    deactivated: scopeId,
    affected,
    unaffected,
    traces,
    guardFiltered: snapshot.guardFiltered,
  };
}

// ── 합성 편의 함수 ───────────────────────────────────

/**
 * scope 비활성화의 영향을 분석한다.
 * 내부: snapshotProviders → traceContracts → classifyImpact.
 */
export function analyzeDeactivation(
  nesting: ScopeNesting,
  scopeId: string,
  guards?: SimulationGuards,
): DeactivationImpact {
  const snapshot = snapshotProviders(nesting, guards);
  const traces = traceContracts(nesting, snapshot, scopeId);
  return classifyImpact(nesting, scopeId, traces, snapshot);
}
