// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * MetricRollupStore — 메트릭 집계 저장 포트.
 *
 * Phase 2 worker에서 metric RecordKind 레코드를 윈도우별로 집계한 결과를 저장한다.
 * counter: 합산, gauge: last-value, histogram: 버킷 머지, summary: 원본 보존.
 */

export type MetricWindowType = "1m" | "1h" | "1d";

export interface MetricRollupInsert {
  metricName: string;
  metricType: string;
  windowType: MetricWindowType;
  windowStart: Date;
  windowEnd: Date;
  addressContext?: Record<string, string>;
  labels?: Record<string, string>;
  // 집계 필드 (MetricType별로 일부만 사용)
  aggSum?: number;
  aggCount?: number;
  aggMin?: number;
  aggMax?: number;
  aggAvg?: number;
  aggLast?: number;
  aggBuckets?: Record<string, number>;   // histogram bucket counts
  aggQuantiles?: Record<string, number>; // summary quantile values
}

export interface StoredMetricRollup extends MetricRollupInsert {
  id: string;
  createdAt: Date;
}

export interface MetricRollupQuery {
  metricName: string;
  windowType: MetricWindowType;
  from: Date;
  to: Date;
  addressContext?: Record<string, string>;
  limit?: number;
}

export interface MetricRollupStore {
  upsert(rollup: MetricRollupInsert): Promise<void>;
  query(params: MetricRollupQuery): Promise<StoredMetricRollup[]>;
}
