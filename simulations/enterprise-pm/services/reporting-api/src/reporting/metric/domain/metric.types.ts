// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import type { MetricId, MetricKey } from './metric.ids.js';

/** Read-side metric DTO — 시계열 단건 record. */
export interface DailyMetricReadModel {
  readonly id: MetricId;
  readonly metricKey: MetricKey;
  /** ISO date — yyyy-mm-dd */
  readonly date: string;
  readonly value: number;
  /** JSON-serialized dimension breakdown */
  readonly dimensions: string;
  readonly computedAt: string;
}
