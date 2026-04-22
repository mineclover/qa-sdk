// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { ReportingRepository } from "../shared/port.js";
import type { Report, ReportCreate, DailyMetric, DailyMetricCreate } from "../shared/types.js";
import { ReportNotFoundError } from "../shared/errors.js";
import { reports, dailyMetrics } from "./schema.js";

export class SqliteReportingRepository implements ReportingRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

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
    this.db.insert(reports).values(r).run();
    return r;
  }

  async findReport(id: string): Promise<Report | null> {
    const rows = this.db.select().from(reports).where(eq(reports.id, id)).limit(1).all();
    return rows[0] ? (rows[0] as Report) : null;
  }

  async listReports(): Promise<Report[]> {
    return this.db.select().from(reports).all() as Report[];
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
    this.db.update(reports).set({
      name: next.name,
      queryDefinition: next.queryDefinition,
      createdBy: next.createdBy,
      updatedAt: next.updatedAt,
    }).where(eq(reports.id, id)).run();
    return next;
  }

  async deleteReport(id: string): Promise<void> {
    this.db.delete(reports).where(eq(reports.id, id)).run();
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
    this.db.insert(dailyMetrics).values(m).run();
    return m;
  }

  async findMetric(metricKey: string, date: string): Promise<DailyMetric | null> {
    const rows = this.db.select().from(dailyMetrics).where(
      and(eq(dailyMetrics.metricKey, metricKey), eq(dailyMetrics.date, date)),
    ).limit(1).all();
    return rows[0] ? (rows[0] as DailyMetric) : null;
  }

  async listMetricsByKey(metricKey: string, fromDate: string, toDate: string): Promise<DailyMetric[]> {
    return this.db.select().from(dailyMetrics).where(
      and(
        eq(dailyMetrics.metricKey, metricKey),
        gte(dailyMetrics.date, fromDate),
        lte(dailyMetrics.date, toDate),
      ),
    ).orderBy(asc(dailyMetrics.date)).all() as DailyMetric[];
  }

  async listMetricKeys(): Promise<string[]> {
    const rows = this.db.selectDistinct({ metricKey: dailyMetrics.metricKey }).from(dailyMetrics).all();
    return rows.map((r) => r.metricKey);
  }
}
