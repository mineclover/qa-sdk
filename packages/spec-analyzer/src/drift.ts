// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Drift 분석기 — 선언 vs 구현 gap 분석.
 */
import type { DeclaredSymbol, DriftReport, ImplementedSymbol } from './types.js';

function normalizeEndpoint(name: string): string {
  // :param → {param} 정규화, trailing slash 제거
  return name.replace(/:(\w+)/g, '{$1}').replace(/\/+$/, '');
}

function matchSymbol(declared: DeclaredSymbol, impl: ImplementedSymbol): boolean {
  if (declared.kind !== impl.kind) return false;
  if (declared.kind === 'endpoint') {
    return normalizeEndpoint(declared.name) === normalizeEndpoint(impl.name);
  }
  return declared.name === impl.name;
}

/**
 * 선언된 심볼과 구현된 심볼을 매칭하여 DriftReport를 생성한다.
 */
export function analyzeDrift(
  specId: string,
  svc: string,
  declared: readonly DeclaredSymbol[],
  implemented: readonly ImplementedSymbol[],
): DriftReport {
  const missing: DeclaredSymbol[] = [];
  const matched = new Set<number>();

  for (const decl of declared) {
    const implIdx = implemented.findIndex(
      (impl, idx) => !matched.has(idx) && matchSymbol(decl, impl),
    );
    if (implIdx >= 0) {
      matched.add(implIdx);
    } else {
      missing.push(decl);
    }
  }

  const undocumented = implemented.filter((_, idx) => !matched.has(idx));
  const coverage = declared.length > 0 ? (declared.length - missing.length) / declared.length : 1;

  return {
    specId,
    svc,
    declared,
    implemented,
    missing,
    undocumented,
    coverage,
  };
}
