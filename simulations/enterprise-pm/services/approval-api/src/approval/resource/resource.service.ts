// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { APPROVAL_REPOSITORY } from "../approval-db.module.js";
import type { ApprovalRepository } from "../shared/port.js";
import type { ResourceRequest, ResourceRequestCreate, RequestStatus } from "../shared/types.js";

@Injectable()
export class ResourceService {
  constructor(@Inject(APPROVAL_REPOSITORY) private readonly repo: ApprovalRepository) {}

  create(args: ResourceRequestCreate): Promise<ResourceRequest> {
    return this.repo.createResourceRequest(args);
  }
  find(id: string): Promise<ResourceRequest | null> {
    return this.repo.findResourceRequest(id);
  }
  updateStatus(id: string, status: RequestStatus): Promise<ResourceRequest> {
    return this.repo.updateResourceRequestStatus(id, status);
  }
}
