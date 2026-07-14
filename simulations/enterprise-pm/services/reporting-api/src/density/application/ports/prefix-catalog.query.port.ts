// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import type { DisjointUnionIndex } from 'weighted-index';

/** Prefix axis 메타데이터 — labels.length == shape[axis_i]. */
export interface PrefixAxisDescriptor {
  readonly name: string;
  readonly labels: readonly string[];
}

/** Prefix descriptor — capacity / decode strategy / labels. */
export interface PrefixDescriptor {
  readonly id: string;
  readonly version: string;
  readonly union: DisjointUnionIndex;
  readonly axes: readonly PrefixAxisDescriptor[];
  readonly coordsOneBased?: boolean;
}

/**
 * Cross-domain query port — prefix catalog 메타데이터 조회.
 *
 * 캐노니컬 prefix 정의는 sim-auth-api 의 auth-codec 이지만 본 서비스는 직접
 * 의존하지 않고 어댑터로 동등 정의를 보유한다 (drift 방지는 plan 14b).
 */
export abstract class PrefixCatalogQueryPort {
  abstract resolve(id: string): Promise<PrefixDescriptor | null>;
}
