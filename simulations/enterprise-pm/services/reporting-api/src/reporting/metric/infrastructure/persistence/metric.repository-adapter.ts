// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { MetricAdminPort } from "../../application/ports/metric-admin.port.js";
import type { RecordMetricCommand } from "../../application/commands/record-metric.command.js";
import type { DailyMetricReadModel } from "../../domain/metric.types.js";
import { toMetricId, toMetricKey } from "../../domain/metric.ids.js";
import type { ReportingRepository } from "../../../shared/port.js";
import type { DailyMetric } from "../../../shared/types.js";

/** Metric admin 어댑터 — ReportingRepository 위에 얹는다. */
export class RepositoryMetricAdminAdapter extends MetricAdminPort {
  constructor(private readonly repository: ReportingRepository) {
    super();
  }

  async record(cmd: RecordMetricCommand): Promise<DailyMetricReadModel> {
    const row = await this.repository.recordMetric({
      metricKey: cmd.metricKey,
      date: cmd.date,
      value: cmd.value,
      dimensions: cmd.dimensions,
    });
    return mapToReadModel(row);
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
