// @def.boundary sim-identifier-grammar
import { z } from "zod";
import { buildServicePrefix, parseServicePrefix, type ServicePrefix } from "./service-prefix.js";
import { buildVersionTag, parseVersionTag, type VersionTag } from "./version-tag.js";

export const BITMAP_SCOPES = ["user", "role"] as const;
export type BitmapScope = (typeof BITMAP_SCOPES)[number];

export interface BitmapCacheKey {
  scope: BitmapScope;
  id: string; // [A-Za-z0-9_-]+
  prefix: ServicePrefix;
  version: VersionTag;
}

// scope·id만 본 grammar에서 직접 검증한다. prefix/version은 #1·#2 builder가 내부적으로
// 입력 형태(ServicePrefixInputSchema / VersionTagInputSchema)를 검증하므로
// 여기서는 그 결과 string에 대한 합성을 보장한다.
const ScopeIdSchema = z.object({
  scope: z.enum(BITMAP_SCOPES),
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
});

export const BitmapCacheKeySchema = z.object({
  scope: z.enum(BITMAP_SCOPES),
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  prefix: z.custom<ServicePrefix>((value) => {
    try {
      buildServicePrefix(value as ServicePrefix);
      return true;
    } catch {
      return false;
    }
  }, "invalid service prefix"),
  version: z.custom<VersionTag>((value) => {
    try {
      buildVersionTag(value as VersionTag);
      return true;
    } catch {
      return false;
    }
  }, "invalid version tag"),
});

export function buildBitmapCacheKey(input: BitmapCacheKey): string {
  ScopeIdSchema.parse({ scope: input.scope, id: input.id });
  // prefix·version은 builder 내부에서 본인 input schema로 검증한다 (#1, #2 재사용).
  const prefixStr = buildServicePrefix(input.prefix);
  const versionStr = buildVersionTag(input.version);
  return `bitmap:${input.scope}:${input.id}:${prefixStr}:${versionStr}`;
}

export function parseBitmapCacheKey(s: string): BitmapCacheKey {
  // prefix·version 모두 ':'를 포함하지 않으므로 ':' split → 정확히 5조각.
  const parts = s.split(":");
  if (parts.length !== 5 || parts[0] !== "bitmap") throw new Error(`invalid bitmap cache key: ${s}`);
  const [, scope, id, prefixStr, versionStr] = parts;
  if (!BITMAP_SCOPES.includes(scope as BitmapScope)) throw new Error(`invalid scope: ${scope}`);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`invalid id: ${id}`);
  return { scope: scope as BitmapScope, id, prefix: parseServicePrefix(prefixStr), version: parseVersionTag(versionStr) };
}
