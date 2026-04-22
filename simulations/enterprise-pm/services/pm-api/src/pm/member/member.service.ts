// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { PM_REPOSITORY } from "../pm-db.module.js";
import type { PmRepository } from "../shared/port.js";
import type { ProjectMember, MemberCreate } from "../shared/types.js";

@Injectable()
export class MemberService {
  constructor(@Inject(PM_REPOSITORY) private readonly repo: PmRepository) {}

  add(args: MemberCreate): Promise<ProjectMember> {
    return this.repo.addMember(args);
  }
  remove(projectId: string, userId: string): Promise<void> {
    return this.repo.removeMember(projectId, userId);
  }
  listForProject(projectId: string): Promise<ProjectMember[]> {
    return this.repo.listMembers(projectId);
  }
  listForUser(userId: string): Promise<ProjectMember[]> {
    return this.repo.listProjectsForUser(userId);
  }
}
