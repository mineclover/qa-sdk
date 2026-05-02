// @def.boundary observability-system-root
// @def.doc observability-system-root

/**
 * address-ranges.ts — PrefixCodec 기반 주소 범위 계산 래퍼.
 *
 * PrefixCodec.getShape()로 shape를 가져오고
 * calcAddressRanges()로 제약 조건에 따른 주소 범위를 계산한다.
 */

import { type PrefixCodec, calcAddressRanges, type CoordConstraint } from "weighted-index";

export interface AddressRangeQuery {
  /** prefix 이름 (예: "svc", "perm") */
  prefix: string;
  /** prefix 버전 (미지정 시 최신) */
  version?: string;
  /** 각 차원의 제약 조건. null=와일드카드, "1-3,7"=특정 범위 */
  constraints: CoordConstraint[];
}

/**
 * PrefixCodec 기반 주소 범위 계산.
 *
 * @returns 정렬된 [min, max][] inclusive 구간 배열
 */
export function buildAddressRanges(
  codec: PrefixCodec,
  query: AddressRangeQuery,
): [number, number][] {
  const shape = codec.getShape(query.prefix, query.version);
  return calcAddressRanges(shape, query.constraints);
}
