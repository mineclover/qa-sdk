// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 집계 포트 — packed_key 기반 그룹핑과 축 프로젝션 추상화.
 *
 * 두 가지 집계 모드:
 *   - groupByKey: packed_key 그대로 GROUP BY (극고속, 인덱스 직접 활용)
 *   - projectAxis: decode → 특정 축만 추출 후 집계 (유연, ad-hoc 분석용)
 */

/** 그룹핑 결과 항목 */
export interface AggregateEntry {
  readonly key: string;
  readonly count: number;
  readonly lastSeen: string;
  readonly payloadSummary?: Record<string, unknown>;
}

/** 축 프로젝션 결과 항목 */
export interface AxisProjectionEntry {
  readonly axisValues: Record<string, string>;
  readonly count: number;
}

/** 집계 쿼리 옵션 */
export interface AggregateOptions {
  /** 시간 범위 시작 (ISO-8601) */
  readonly from?: string;
  /** 시간 범위 끝 (ISO-8601) */
  readonly to?: string;
  /** 최대 반환 그룹 수 */
  readonly limit?: number;
}

export interface Aggregator {
  /**
   * packed_key 기반 그룹핑.
   * DB의 `GROUP BY packed_key`에 직접 매핑된다.
   */
  groupByKey(keys: readonly string[], options?: AggregateOptions): Promise<AggregateEntry[]>;

  /**
   * 축 프로젝션 집계.
   * keys를 decode → 지정 축 값만 추출 → 조합별 count.
   * 전체 decode 대신 shift/modulo 단축 가능.
   */
  projectAxis(
    keys: readonly string[],
    axes: readonly string[],
    options?: AggregateOptions,
  ): Promise<AxisProjectionEntry[]>;
}
