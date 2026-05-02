// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/** Prefix 식별자 — density 계산 대상의 좌표축 묶음 식별자. */
export type PrefixId = string & { readonly __brand: "PrefixId" };

/** Catalog 식별자 — prefix 가 속한 카탈로그 (예: "sim"). */
export type CatalogId = string & { readonly __brand: "CatalogId" };

/** Prefix version — capacity 변화에 따른 incrementing version (예: "uv1"). */
export type PrefixVersion = string & { readonly __brand: "PrefixVersion" };

export function toPrefixId(value: string): PrefixId {
  return value as PrefixId;
}
export function toCatalogId(value: string): CatalogId {
  return value as CatalogId;
}
export function toPrefixVersion(value: string): PrefixVersion {
  return value as PrefixVersion;
}
