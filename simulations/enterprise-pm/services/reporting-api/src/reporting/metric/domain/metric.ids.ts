// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

/** Metric 단건의 식별자 (uuid). */
export type MetricId = string & { readonly __brand: 'MetricId' };

/** Metric key — 예: "marginal_density.sim.budget" — 시계열 시리즈 식별자. */
export type MetricKey = string & { readonly __brand: 'MetricKey' };

export function toMetricId(value: string): MetricId {
  return value as MetricId;
}

export function toMetricKey(value: string): MetricKey {
  return value as MetricKey;
}
