// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

/**
 * Metric record admin 명령 — 외부 ingest pipeline 또는 내부 projector 가
 * 측정 결과를 시계열에 적재할 때 호출. 이벤트 emit 없음.
 */
export interface RecordMetricCommand {
  readonly metricKey: string;
  /** ISO date — yyyy-mm-dd */
  readonly date: string;
  readonly value: number;
  /** JSON: dimension breakdown */
  readonly dimensions: string;
}
