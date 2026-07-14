// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import type { DailyMetricReadModel } from '../../domain/metric.types.js';

/** Read 전용 query port. 시계열 단건/범위/key 목록 조회. */
export abstract class MetricReadModelQuery {
  /** metricKey + date 단건. 미존재 → null. */
  abstract findOne(metricKey: string, date: string): Promise<DailyMetricReadModel | null>;
  /** metricKey 의 fromDate~toDate (ISO date 문자열) 범위. asc(date). */
  abstract listByKey(
    metricKey: string,
    fromDate: string,
    toDate: string,
  ): Promise<DailyMetricReadModel[]>;
  /** distinct metricKey 목록. */
  abstract listKeys(): Promise<string[]>;
}
