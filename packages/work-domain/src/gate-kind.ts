// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import {
  type GateKindId,
  type GateScope,
  type GateKindDef,
  GATE_KINDS,
  ALL_GATE_KIND_IDS,
} from 'test-types';

export type { GateKindId, GateScope, GateKindDef };
export { GATE_KINDS, ALL_GATE_KIND_IDS };

// ─── 조회 유틸 ──────────────────────────────────────────

/** ID로 게이트 유형 정의 조회 */
export function getGateKindDef(id: GateKindId): GateKindDef {
  const found = GATE_KINDS.find((k) => k.id === id);
  if (!found) throw new Error(`알 수 없는 Gate Kind: ${id}`);
  return found;
}

/** scope로 게이트 유형 필터 */
export function getGateKindsByScope(scope: GateScope): readonly GateKindDef[] {
  return GATE_KINDS.filter((k) => k.scope === scope);
}

/** scope별 게이트 유형 수 (커버리지 파악용) */
export function countByScope(): Record<GateScope, number> {
  const counts: Record<string, number> = {};
  for (const kind of GATE_KINDS) {
    counts[kind.scope] = (counts[kind.scope] ?? 0) + 1;
  }
  return counts as Record<GateScope, number>;
}
