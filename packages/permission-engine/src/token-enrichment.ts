// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * token-enrichment.ts — JWT 토큰에 permission bitmask를 임베드.
 *
 * Zitadel Action 또는 Keycloak Protocol Mapper에서 호출한다.
 * 토큰 발급 시점에 Permission DB → 최종 mask 계산 → JWT claims 반환.
 *
 * 반환된 claims를 provider가 JWT에 병합한다:
 *   { perms, perms_v, perms_schema }
 *
 * perms_schema: RoleRegistry의 feature 정의 해시.
 *   schema가 바뀌면 (feature 추가/제거) 구 토큰을 자동으로 무효화한다.
 */

import { type RoleRegistry } from './role-registry.js';
import { type UserPermissionEngine } from './user-permission-engine.js';
import { type PermissionVersionStore } from './permission-version.js';
import { type ResolutionContext } from './role-resolver.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** JWT에 임베드되는 permission claims. */
export interface PermissionClaims {
  /** domain → base64 encoded bitmask (최종 mask, override 적용 후). */
  perms: Record<string, string>;
  /** 발급 시점의 유저 권한 버전. 미들웨어가 비교한다. */
  perms_v: number;
  /**
   * RoleRegistry feature 정의 해시.
   * schema 변경(feature 추가/삭제) 시 구 토큰을 자동 무효화한다.
   */
  perms_schema: string;
}

/** 유저 컨텍스트 로더. Permission DB에서 ResolutionContext를 로드한다. */
export type ContextLoader = (userId: string) => Promise<ResolutionContext>;

// ── TokenEnrichmentHandler ────────────────────────────────────────────────────

export class TokenEnrichmentHandler {
  constructor(
    private readonly engine: UserPermissionEngine,
    private readonly roleRegistry: RoleRegistry,
    private readonly versionStore: PermissionVersionStore,
    private readonly contextLoader: ContextLoader,
  ) {}

  /**
   * userId에 대한 permission claims를 계산한다.
   * Zitadel Action / Keycloak Mapper에서 이 메서드를 호출한다.
   */
  async enrich(userId: string): Promise<PermissionClaims> {
    const [ctx, version] = await Promise.all([
      this.contextLoader(userId),
      this.versionStore.getVersion(userId),
    ]);

    const domains = this.engine.accessibleDomains(userId, ctx);
    const perms: Record<string, string> = {};

    for (const domain of domains) {
      const { mask } = this.engine.resolveFinalMask(userId, ctx, domain);
      if (mask.length > 0) {
        perms[domain] = _uint8ToBase64(mask);
      }
    }

    return {
      perms,
      perms_v: version,
      perms_schema: computeSchemaHash(this.roleRegistry),
    };
  }
}

// ── 스키마 해시 ───────────────────────────────────────────────────────────────

/**
 * RoleRegistry의 feature 정의로부터 해시를 계산한다.
 * feature 추가/삭제/순서 변경 시 해시가 달라진다.
 *
 * djb2 변형 — 암호학적 강도 불필요, 빠른 일치 감지용.
 */
export function computeSchemaHash(roleRegistry: RoleRegistry): string {
  const snapshot: Record<string, string[]> = {};
  for (const domain of roleRegistry.domains()) {
    snapshot[domain] = roleRegistry.domainFeatureIds(domain);
  }
  const json = JSON.stringify(snapshot, Object.keys(snapshot).toSorted());
  return _djb2(json).toString(16);
}

function _djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // uint32
  }
  return h;
}

// ── Base64 ────────────────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function _uint8ToBase64(arr: Uint8Array): string {
  let out = '';
  for (let i = 0; i < arr.length; i += 3) {
    const b0 = arr[i],
      b1 = arr[i + 1] ?? 0,
      b2 = arr[i + 2] ?? 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < arr.length ? B64[((b1 & 0xf) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < arr.length ? B64[b2 & 0x3f] : '=';
  }
  return out;
}

export function base64ToUint8(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2] ?? '');
    const d = B64.indexOf(clean[i + 3] ?? '');
    bytes[j++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[j++] = ((b & 0xf) << 4) | (c >> 2);
    if (d >= 0) bytes[j++] = ((c & 3) << 6) | d;
  }
  return bytes.slice(0, j);
}
