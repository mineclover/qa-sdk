// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Observable, from, lastValueFrom, defer, mergeMap } from 'rxjs';

import type { RlsSessionContext } from './rls-session.js';
import { withRlsContext } from './rls-context-storage.js';

/**
 * JWT claim shape — sim-gateway + auth-api 공통.
 * sub         : userId
 * tenantId    : tenant 경계
 * bitmap.mask_hex : 타입 레벨 bitmap (hex TEXT, permission-engine VersionedBitmap.mask)
 * role        : 'admin' 이면 admin bypass (optional)
 */
export interface RlsJwtClaims {
  sub: string;
  tenantId?: string;
  bitmap?: { version?: string; mask_hex?: string };
  role?: string;
}

/** hex TEXT → Uint8Array. 비-hex 문자 또는 홀수 길이는 throw. */
export function decodeBitmapHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error(`bitmap hex odd length: ${clean.length}`);
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error(`bitmap hex non-hex char: ${clean}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function claimsToRlsContext(claims: RlsJwtClaims | null): RlsSessionContext {
  if (!claims) {
    return { userId: null, tenantId: null, bitmapMask: null, role: null };
  }
  let mask: Uint8Array | null = null;
  if (claims.bitmap?.mask_hex) {
    try {
      mask = decodeBitmapHex(claims.bitmap.mask_hex);
    } catch {
      mask = null; // 잘못된 hex → default deny
    }
  }
  return {
    userId: claims.sub ?? null,
    tenantId: claims.tenantId ?? null,
    bitmapMask: mask,
    role: claims.role === 'admin' ? 'admin' : null,
  };
}

/**
 * request.user (또는 request.auth) 에서 JWT claim 을 읽어 RlsSessionContext 로 변환 후
 * AsyncLocalStorage 에 bind. NestJS 전체 요청 처리 체인이 withRlsContext 안에서 실행됨.
 */
@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  constructor(
    private readonly options: {
      claimsAccessor?: (req: unknown) => RlsJwtClaims | null;
    } = {},
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ user?: RlsJwtClaims; auth?: RlsJwtClaims }>();
    const claims = this.options.claimsAccessor
      ? this.options.claimsAccessor(req)
      : (req.user ?? req.auth ?? null);
    const rlsCtx = claimsToRlsContext(claims);
    return defer(() => from(withRlsContext(rlsCtx, () => lastValueFrom(next.handle())))).pipe(
      mergeMap((value) => from(Promise.resolve(value))),
    );
  }
}
