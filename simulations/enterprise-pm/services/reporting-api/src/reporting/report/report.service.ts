// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { REPORTING_REPOSITORY } from "../reporting-db.module.js";
import type { ReportingRepository } from "../shared/port.js";
import type { Report, ReportCreate } from "../shared/types.js";

@Injectable()
export class ReportService {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly repo: ReportingRepository) {}

  create(args: ReportCreate): Promise<Report> {
    return this.repo.createReport(args);
  }
  find(id: string): Promise<Report | null> {
    return this.repo.findReport(id);
  }
  list(): Promise<Report[]> {
    return this.repo.listReports();
  }
  update(id: string, patch: Partial<ReportCreate>): Promise<Report> {
    return this.repo.updateReport(id, patch);
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteReport(id);
  }
}
