// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { ReportReadModelQuery } from "../../application/queries/report-read-model.query.js";
import type {
  ReportReadModel,
  ReportSummaryReadModel,
} from "../../domain/report.types.js";
import type { ReportId } from "../../domain/report.ids.js";
import { toReportId } from "../../domain/report.ids.js";
import type { ReportingRepository } from "../../../shared/port.js";
import type { Report } from "../../../shared/types.js";

/**
 * Repository 위에 얇게 얹은 Read Model 어댑터.
 *
 * shared/port.ts 의 ReportingRepository 를 통해 reports 테이블을 read-only 로
 * 조회하고, ReportId brand 적용 후 read DTO 로 매핑한다.
 */
export class RepositoryReportReadModel extends ReportReadModelQuery {
  constructor(private readonly repository: ReportingRepository) {
    super();
  }

  async findDetail(id: string): Promise<ReportReadModel | null> {
    const row = await this.repository.findReport(id);
    if (!row) return null;
    return mapToReadModel(row);
  }

  async listAll(): Promise<ReportSummaryReadModel[]> {
    const rows = await this.repository.listReports();
    return rows.map(mapToReadModel);
  }
}

function mapToReadModel(row: Report): ReportReadModel {
  const id: ReportId = toReportId(row.id);
  return {
    id,
    name: row.name,
    queryDefinition: row.queryDefinition,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
