// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Branded type helper — 구조적으로 동일하지만 의미적으로 구분되는 타입.
 *
 * DocumentAddress와 PrefixAddress가 둘 다 number이지만 혼동되지 않도록.
 */
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** 문서 좌표 주소 (scope × aspect × depth × seq) */
export type DocumentAddress = Brand<number, "DocumentAddress">;

/** prefix 가중치 주소 (WeightedIndex 인코딩 결과) */
export type PrefixAddress = Brand<number, "PrefixAddress">;

/** 문서 주소 생성 */
export function documentAddress(n: number): DocumentAddress {
  return n as DocumentAddress;
}

/** prefix 주소 생성 */
export function prefixAddress(n: number): PrefixAddress {
  return n as PrefixAddress;
}
