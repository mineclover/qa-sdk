// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free.
 *
 * mapDomainErrorToHttp 가 name 으로 status 결정.
 *   - NotFoundError → 404
 */
export class MetricDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MetricDomainException";
  }
}

/** Metric 시계열 record 부재 (HTTP 404 매핑). */
export class MetricNotFoundException extends MetricDomainException {
  constructor(public readonly metricKey: string, public readonly date: string) {
    super("METRIC_NOT_FOUND", `Metric not found: ${metricKey}/${date}`);
    this.name = "NotFoundError";
  }
}
