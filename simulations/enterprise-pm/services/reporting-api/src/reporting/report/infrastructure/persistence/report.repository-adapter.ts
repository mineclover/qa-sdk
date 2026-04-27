// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { ReportAdminPort } from "../../application/ports/report-admin.port.js";
import type {
  CreateReportCommand,
  DeleteReportCommand,
  UpdateReportCommand,
} from "../../application/commands/upsert-report.command.js";
import type { ReportReadModel } from "../../domain/report.types.js";
import { toReportId } from "../../domain/report.ids.js";
import type { ReportingRepository } from "../../../shared/port.js";
import type { Report } from "../../../shared/types.js";

/**
 * Report admin 어댑터 — 기존 ReportingRepository 위에 얹는다.
 *
 * 본 슬라이스는 자체 drizzle schema 를 갖지 않는다 (read-model 슬라이스가 단일
 * reports 테이블을 reporting-db.module 의 통합 repository 로 공유). 어댑터는
 * 결과를 ReportReadModel 로 매핑한다.
 */
export class RepositoryReportAdminAdapter extends ReportAdminPort {
  constructor(private readonly repository: ReportingRepository) {
    super();
  }

  async create(cmd: CreateReportCommand): Promise<ReportReadModel> {
    const row = await this.repository.createReport({
      name: cmd.name,
      queryDefinition: cmd.queryDefinition,
      createdBy: cmd.createdBy,
    });
    return mapToReadModel(row);
  }

  async update(cmd: UpdateReportCommand): Promise<ReportReadModel> {
    const { id, ...patch } = cmd;
    const row = await this.repository.updateReport(id, patch);
    return mapToReadModel(row);
  }

  async delete(cmd: DeleteReportCommand): Promise<void> {
    await this.repository.deleteReport(cmd.id);
  }
}

function mapToReadModel(row: Report): ReportReadModel {
  return {
    id: toReportId(row.id),
    name: row.name,
    queryDefinition: row.queryDefinition,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
