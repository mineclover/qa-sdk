// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { RlsSessionContext } from './rls-session.js';

/** shadow 기록의 인자. */
export interface RlsShadowQuery {
  resourceTable: string; // 'auth.resource_policies' 등
  operation: 'select' | 'insert' | 'update' | 'delete';
  requiredBit?: number; // 해당 op 에 필요한 bitmap bit. undefined 면 bit 검사 skip
  tenantScoped?: boolean; // ingest.* 처럼 tenant 경계가 필수인 테이블
  ownerField?: 'user_id_match' | 'actor_match' | 'none';
}

export type RlsWouldDecision = 'allow' | 'deny' | 'unknown';

export interface RlsShadowPrediction {
  decision: RlsWouldDecision;
  denyReason: string | null;
}

/**
 * TS-level 예측 — DB 왕복 없이 context 만으로 allow/deny/unknown 결정.
 * state 기반 조건(UNREGISTERED/REGISTERED)은 resource_id 조회가 필요하므로 'unknown'.
 */
export function predictRlsDecision(
  ctx: RlsSessionContext,
  query: RlsShadowQuery,
): RlsShadowPrediction {
  if (ctx.role === 'admin') {
    return { decision: 'allow', denyReason: null };
  }
  if (!ctx.userId) {
    return { decision: 'deny', denyReason: 'user_id_missing' };
  }
  if (query.tenantScoped && !ctx.tenantId) {
    return { decision: 'deny', denyReason: 'tenant_id_missing' };
  }
  if (typeof query.requiredBit === 'number') {
    if (!ctx.bitmapMask) {
      return { decision: 'deny', denyReason: 'bitmap_mask_missing' };
    }
    const byteIdx = Math.floor(query.requiredBit / 8);
    const bitIdx = query.requiredBit % 8;
    if (byteIdx >= ctx.bitmapMask.byteLength) {
      return { decision: 'deny', denyReason: 'bitmap_bit_missing' };
    }
    if ((ctx.bitmapMask[byteIdx] & (1 << bitIdx)) === 0) {
      return { decision: 'deny', denyReason: 'bitmap_bit_missing' };
    }
  }
  // owner 일치 여부는 resource_id 없이 결정 불가 → unknown
  if (query.ownerField && query.ownerField !== 'none') {
    return { decision: 'unknown', denyReason: 'needs_db_resolve' };
  }
  return { decision: 'allow', denyReason: null };
}
