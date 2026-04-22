// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import type { Report, ReportCreate, DailyMetric, DailyMetricCreate } from "./types.js";

export interface ReportingRepository {
  // Report
  createReport(args: ReportCreate): Promise<Report>;
  findReport(id: string): Promise<Report | null>;
  listReports(): Promise<Report[]>;
  updateReport(id: string, patch: Partial<ReportCreate>): Promise<Report>;
  deleteReport(id: string): Promise<void>;

  // DailyMetric
  recordMetric(args: DailyMetricCreate): Promise<DailyMetric>;
  findMetric(metricKey: string, date: string): Promise<DailyMetric | null>;
  listMetricsByKey(metricKey: string, fromDate: string, toDate: string): Promise<DailyMetric[]>;
  listMetricKeys(): Promise<string[]>;
}
