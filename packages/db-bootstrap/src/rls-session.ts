// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { Sql } from 'postgres';

/**
 * postgres driver 의 begin() 콜백이 받는 트랜잭션 객체 타입.
 *
 * postgres@3.4.x 의 TransactionSql 는 직접 import 시 tagged template call
 * signature 가 노출되지 않는 typings 한계가 있다. Sql 과 동일 표면을 제공하므로
 * Sql 으로 alias — 호출 측에서는 sql.begin() 콜백 인자를 그대로 받아 사용한다.
 * 런타임 동작은 완전히 동일.
 */
export type RlsTxSql = Sql;

/**
 * PG RLS 정책이 참조하는 세션 컨텍스트 (spec §1 Session context).
 * - userId   → auth.current_user_id() — resource owner / audit actor 매칭
 * - tenantId → app.tenant_id            — ingest cross-tenant 경계
 * - bitmapMask → auth.has_bit(pos)      — 타입 레벨 정적 권한
 * - role     → 'admin' 이면 admin bypass 정책 매칭
 */
export interface RlsSessionContext {
  readonly userId: string | null;
  readonly tenantId: string | null;
  readonly bitmapMask: Uint8Array | null;
  readonly role: 'admin' | null;
}

export const EMPTY_RLS_CONTEXT: RlsSessionContext = Object.freeze({
  userId: null,
  tenantId: null,
  bitmapMask: null,
  role: null,
});

/** spec §주의사항 "bitmap 크기 제한 — 2^20 (128KB) 권장". 초과 시 명시적 거절. */
export const MAX_BITMAP_BYTES = 128 * 1024;

export class BitmapTooLargeError extends Error {
  constructor(public readonly size: number) {
    super(`bitmap mask ${size} bytes exceeds MAX_BITMAP_BYTES=${MAX_BITMAP_BYTES}`);
    this.name = 'BitmapTooLargeError';
  }
}

/** Uint8Array → lowercase hex TEXT (PG 의 decode(..., 'hex') 포맷과 일치). */
export function encodeBitmapHex(mask: Uint8Array): string {
  if (mask.byteLength > MAX_BITMAP_BYTES) {
    throw new BitmapTooLargeError(mask.byteLength);
  }
  let out = '';
  for (let i = 0; i < mask.length; i += 1) {
    out += mask[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * 트랜잭션 안에서 RlsSessionContext 를 SET LOCAL 로 주입한 뒤 fn 을 실행.
 *
 * 각 호출은 단일 트랜잭션 — SET LOCAL 이 자동 clear 되어 connection pool 재사용 시에도
 * 세션 컨텍스트 유출 없음. null 인 필드는 SET 자체를 skip (helper 에서 NULL 로 처리 → default deny).
 */
export type RlsTxRunner = <T>(
  ctx: RlsSessionContext,
  fn: (tx: RlsTxSql) => Promise<T>,
) => Promise<T>;

export function createRlsTxRunner(sql: Sql): RlsTxRunner {
  return async <T>(ctx: RlsSessionContext, fn: (tx: RlsTxSql) => Promise<T>) => {
    return sql.begin(async (txRaw) => {
      // postgres@3.4.x typings 한계: TransactionSql<{}> 는 tagged template call
      // signature 가 노출되지 않는다. 런타임 동작은 Sql 과 동일하므로 cast.
      const tx = txRaw as unknown as RlsTxSql;
      // SET LOCAL 은 parameterized 불가 → set_config(name, value, is_local) 사용.
      if (ctx.userId !== null) {
        await tx`SELECT set_config('app.user_id', ${ctx.userId}, true)`;
      }
      if (ctx.tenantId !== null) {
        await tx`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
      }
      if (ctx.bitmapMask !== null) {
        const hex = encodeBitmapHex(ctx.bitmapMask);
        await tx`SELECT set_config('app.bitmap_mask', ${hex}, true)`;
      }
      if (ctx.role !== null) {
        await tx`SELECT set_config('app.role', ${ctx.role}, true)`;
      }
      return fn(tx);
    }) as Promise<T>;
  };
}
