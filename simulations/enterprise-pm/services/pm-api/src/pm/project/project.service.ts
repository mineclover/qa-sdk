// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { Inject, Injectable, Optional } from "@nestjs/common";
import { createLogger } from "../../lib/logger.js";
import type { ResourcePolicyRegistry } from "permission-engine";
import { PM_REPOSITORY } from "../pm-db.module.js";
import type { PmRepository } from "../shared/port.js";
import type { Project, ProjectCreate } from "../shared/types.js";
import { PROJECT_POLICY_REGISTRY } from "../../auth-deps/access-checker.module.js";

const log = createLogger("sim-pm-api.project.service");

/**
 * ProjectService.create 는 2-step:
 *   1. projects INSERT (PmRepository)
 *   2. resource-policy-store create — state=UNREGISTERED, ownerId=입력값
 *
 * policy 등록 실패 시 projects 롤백 (PmRepository 의 deleteProject 호출) — orphan 방지.
 * design.md §3 lifecycle: UNREGISTERED 는 owner 만 접근 허용 (Pass 2 분기).
 */
@Injectable()
export class ProjectService {
  constructor(
    @Inject(PM_REPOSITORY) private readonly repo: PmRepository,
    @Optional()
    @Inject(PROJECT_POLICY_REGISTRY)
    private readonly policies?: ResourcePolicyRegistry,
  ) {}

  async create(args: ProjectCreate): Promise<Project> {
    const project = await this.repo.createProject(args);
    if (!this.policies) {
      // 운영 부팅에서 AccessCheckerModule 이 registry 를 등록해야 하나,
      // 레거시 호출자 (policy registry 없는 env) 는 orphan 위험을 로깅만.
      log.warn({ projectId: project.id }, "PROJECT_POLICY_REGISTRY 미등록 — UNREGISTERED policy 생성 생략");
      return project;
    }
    try {
      await this.policies.create({
        resourceId: project.id,
        resourceType: "project",
        ownerId: args.ownerId,
      });
    } catch (err) {
      log.error({ err, projectId: project.id }, "policy 생성 실패 — project 롤백");
      await this.repo.deleteProject(project.id);
      throw err;
    }
    return project;
  }

  find(id: string): Promise<Project | null> {
    return this.repo.findProject(id);
  }

  listByDepartment(deptId: string): Promise<Project[]> {
    return this.repo.listProjectsByDepartment(deptId);
  }

  listByOwner(ownerId: string): Promise<Project[]> {
    return this.repo.listProjectsByOwner(ownerId);
  }

  update(id: string, patch: Partial<ProjectCreate>): Promise<Project> {
    return this.repo.updateProject(id, patch);
  }

  async delete(id: string): Promise<void> {
    // policy 도 함께 제거 — §3 lifecycle: deleted → ARCHIVED 는 별도 Plan.
    await this.repo.deleteProject(id);
    if (this.policies) {
      await this.policies.remove(id).catch((err) => {
        log.warn({ err, projectId: id }, "policy 삭제 실패 — orphan policy 가능");
      });
    }
  }
}
