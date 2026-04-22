// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { APPROVAL_REPOSITORY } from "../approval-db.module.js";
import type { ApprovalRepository } from "../shared/port.js";
import type { TimeOffRequest, TimeOffRequestCreate, RequestStatus } from "../shared/types.js";

@Injectable()
export class TimeOffService {
  constructor(@Inject(APPROVAL_REPOSITORY) private readonly repo: ApprovalRepository) {}

  create(args: TimeOffRequestCreate): Promise<TimeOffRequest> {
    return this.repo.createTimeOffRequest(args);
  }
  find(id: string): Promise<TimeOffRequest | null> {
    return this.repo.findTimeOffRequest(id);
  }
  updateStatus(id: string, status: RequestStatus): Promise<TimeOffRequest> {
    return this.repo.updateTimeOffRequestStatus(id, status);
  }
}
