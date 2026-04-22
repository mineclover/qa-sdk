// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

export interface Report {
  id: string;
  name: string;
  /** JSON-serialized 쿼리 정의 — 본 plan은 string으로만 영속, 실제 쿼리 실행은 별도. */
  queryDefinition: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyMetric {
  id: string;
  metricKey: string;       // "marginal_density.sim.budget"
  /** ISO date — yyyy-mm-dd */
  date: string;
  value: number;
  /** JSON: dimension breakdown */
  dimensions: string;
  computedAt: string;
}

export interface ReportCreate {
  name: string;
  queryDefinition: string;
  createdBy: string;
}

export interface DailyMetricCreate {
  metricKey: string;
  date: string;
  value: number;
  dimensions: string;
}
