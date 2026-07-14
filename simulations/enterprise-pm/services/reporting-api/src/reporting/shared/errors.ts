// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

export class ReportNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Report not found: ${id}`);
    this.name = 'ReportNotFoundError';
  }
}

export class MetricNotFoundError extends Error {
  constructor(
    public readonly metricKey: string,
    public readonly date: string,
  ) {
    super(`Metric not found: ${metricKey}/${date}`);
    this.name = 'MetricNotFoundError';
  }
}
