// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { APPROVAL_REPOSITORY } from "../approval-db.module.js";
import type { ApprovalRepository } from "../shared/port.js";
import type { ExpenseReport, ExpenseReportCreate, RequestStatus } from "../shared/types.js";

@Injectable()
export class ExpenseService {
  constructor(@Inject(APPROVAL_REPOSITORY) private readonly repo: ApprovalRepository) {}

  create(args: ExpenseReportCreate): Promise<ExpenseReport> {
    return this.repo.createExpenseReport(args);
  }
  find(id: string): Promise<ExpenseReport | null> {
    return this.repo.findExpenseReport(id);
  }
  updateStatus(id: string, status: RequestStatus): Promise<ExpenseReport> {
    return this.repo.updateExpenseReportStatus(id, status);
  }
}
