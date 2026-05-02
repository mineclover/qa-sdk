// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { ReportingRepository } from "../shared/port.js";
import type { Report, ReportCreate, DailyMetric, DailyMetricCreate } from "../shared/types.js";
import { ReportNotFoundError } from "../shared/errors.js";
import { reports, dailyMetrics } from "./schema.js";

export class PgReportingRepository implements ReportingRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  async createReport(args: ReportCreate): Promise<Report> {
    const now = new Date().toISOString();
    const r: Report = {
      id: randomUUID(),
      name: args.name,
      queryDefinition: args.queryDefinition,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(reports).values(r);
    return r;
  }

  async findReport(id: string): Promise<Report | null> {
    const rows = await this.db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return rows[0] ? (rows[0] as Report) : null;
  }

  async listReports(): Promise<Report[]> {
    return (await this.db.select().from(reports)) as Report[];
  }

  async updateReport(id: string, patch: Partial<ReportCreate>): Promise<Report> {
    const cur = await this.findReport(id);
    if (!cur) throw new ReportNotFoundError(id);
    const now = new Date().toISOString();
    const next: Report = {
      ...cur,
      name: patch.name ?? cur.name,
      queryDefinition: patch.queryDefinition ?? cur.queryDefinition,
      createdBy: patch.createdBy ?? cur.createdBy,
      updatedAt: now,
    };
    await this.db.update(reports).set({
      name: next.name,
      queryDefinition: next.queryDefinition,
      createdBy: next.createdBy,
      updatedAt: next.updatedAt,
    }).where(eq(reports.id, id));
    return next;
  }

  async deleteReport(id: string): Promise<void> {
    await this.db.delete(reports).where(eq(reports.id, id));
  }

  async recordMetric(args: DailyMetricCreate): Promise<DailyMetric> {
    const now = new Date().toISOString();
    const m: DailyMetric = {
      id: randomUUID(),
      metricKey: args.metricKey,
      date: args.date,
      value: args.value,
      dimensions: args.dimensions,
      computedAt: now,
    };
    await this.db.insert(dailyMetrics).values(m);
    return m;
  }

  async findMetric(metricKey: string, date: string): Promise<DailyMetric | null> {
    const rows = await this.db.select().from(dailyMetrics).where(
      and(eq(dailyMetrics.metricKey, metricKey), eq(dailyMetrics.date, date)),
    ).limit(1);
    return rows[0] ? (rows[0] as DailyMetric) : null;
  }

  async listMetricsByKey(
    metricKey: string,
    fromDate: string,
    toDate: string,
  ): Promise<DailyMetric[]> {
    return (await this.db.select().from(dailyMetrics).where(
      and(
        eq(dailyMetrics.metricKey, metricKey),
        gte(dailyMetrics.date, fromDate),
        lte(dailyMetrics.date, toDate),
      ),
    ).orderBy(asc(dailyMetrics.date))) as DailyMetric[];
  }

  async listMetricKeys(): Promise<string[]> {
    const rows = await this.db.selectDistinct({ metricKey: dailyMetrics.metricKey }).from(dailyMetrics);
    return rows.map((r) => r.metricKey);
  }
}
