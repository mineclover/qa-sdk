// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { REPORTING_REPOSITORY } from "../reporting-db.module.js";
import type { ReportingRepository } from "../shared/port.js";
import type { DailyMetric, DailyMetricCreate } from "../shared/types.js";

@Injectable()
export class MetricService {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly repo: ReportingRepository) {}

  record(args: DailyMetricCreate): Promise<DailyMetric> {
    return this.repo.recordMetric(args);
  }
  find(metricKey: string, date: string): Promise<DailyMetric | null> {
    return this.repo.findMetric(metricKey, date);
  }
  listByKey(metricKey: string, fromDate: string, toDate: string): Promise<DailyMetric[]> {
    return this.repo.listMetricsByKey(metricKey, fromDate, toDate);
  }
  listKeys(): Promise<string[]> {
    return this.repo.listMetricKeys();
  }
}
