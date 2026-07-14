// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { MetricReadModelQuery } from '../../application/queries/metric-read-model.query.js';
import type { DailyMetricReadModel } from '../../domain/metric.types.js';
import { toMetricId, toMetricKey } from '../../domain/metric.ids.js';
import type { ReportingRepository } from '../../../shared/port.js';
import type { DailyMetric } from '../../../shared/types.js';

/**
 * Repository 위에 얇게 얹은 시계열 Read Model 어댑터.
 * shared/port.ts 의 ReportingRepository read API 를 호출하고 read DTO 로 매핑.
 */
export class RepositoryMetricReadModel extends MetricReadModelQuery {
  constructor(private readonly repository: ReportingRepository) {
    super();
  }

  async findOne(metricKey: string, date: string): Promise<DailyMetricReadModel | null> {
    const row = await this.repository.findMetric(metricKey, date);
    if (!row) return null;
    return mapToReadModel(row);
  }

  async listByKey(
    metricKey: string,
    fromDate: string,
    toDate: string,
  ): Promise<DailyMetricReadModel[]> {
    const rows = await this.repository.listMetricsByKey(metricKey, fromDate, toDate);
    return rows.map(mapToReadModel);
  }

  async listKeys(): Promise<string[]> {
    return this.repository.listMetricKeys();
  }
}

function mapToReadModel(row: DailyMetric): DailyMetricReadModel {
  return {
    id: toMetricId(row.id),
    metricKey: toMetricKey(row.metricKey),
    date: row.date,
    value: row.value,
    dimensions: row.dimensions,
    computedAt: row.computedAt,
  };
}
