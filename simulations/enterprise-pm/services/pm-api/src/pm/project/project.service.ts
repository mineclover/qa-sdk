// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { Inject, Injectable, Optional } from "@nestjs/common";
import { createLogger } from "../../lib/logger.js";
import type { ResourcePolicyRegistry } from "permission-engine";
import type { AuthorizationGraphSnapshotRecord } from "authorization-ontology";
import { PM_REPOSITORY } from "../pm-db.module.js";
import type { PmRepository } from "../shared/port.js";
import type { Project, ProjectCreate } from "../shared/types.js";
import {
  PROJECT_DELEGATION_GRAPH,
  PROJECT_POLICY_REGISTRY,
} from "../../auth-deps/access-checker.module.js";
import type { ProjectDelegationGraphStore } from "../../auth-deps/delegation-graph-store.js";

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
    @Optional()
    @Inject(PROJECT_DELEGATION_GRAPH)
    private readonly delegationGraph?: ProjectDelegationGraphStore,
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

  async getDelegationSnapshot(projectId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    if (!this.policies || !this.delegationGraph) return null;
    const policy = await this.policies.resolve(projectId);
    if (!policy?.graphRootId) return null;
    return (await this.delegationGraph.getLatest(policy.graphRootId)) ?? null;
  }

  async addDelegate(args: {
    projectId: string;
    delegateUserId: string;
  }): Promise<{ state: string; graphRootId: string; delegateUserId: string }> {
    if (!this.policies || !this.delegationGraph) {
      throw new Error("PROJECT_POLICY_REGISTRY or PROJECT_DELEGATION_GRAPH not registered — addDelegate 불가");
    }
    const cur = await this.policies.resolve(args.projectId);
    if (!cur) {
      throw new Error(`policy not found for project ${args.projectId}`);
    }
    if (cur.state !== "DELEGATED" || !cur.graphRootId) {
      throw new Error(`project ${args.projectId} is not in DELEGATED state`);
    }
    await this.delegationGraph.grant(cur.graphRootId, args.delegateUserId);
    return {
      state: cur.state,
      graphRootId: cur.graphRootId,
      delegateUserId: args.delegateUserId,
    };
  }

  /**
   * delegate — Plan 13c 시나리오 6. resource-policy 를 DELEGATED 상태로 전이.
   *
   * 전제: 현재 UNREGISTERED 또는 REGISTERED. graphRootId 설정 후
   * InstancePolicyEvaluator.evaluateDelegated 가 Pass 2 에서 호출됨.
   */
  async delegate(args: {
    projectId: string;
    graphRootId: string;
    delegateUserId: string;
  }): Promise<{ state: string; graphRootId: string }> {
    if (!this.policies) {
      throw new Error("PROJECT_POLICY_REGISTRY not registered — delegate 불가");
    }
    // policy 가 UNREGISTERED 면 먼저 REGISTERED 로 전이 (cerbosPolicyRef 요구).
    const cur = await this.policies.resolve(args.projectId);
    if (!cur) {
      throw new Error(`policy not found for project ${args.projectId}`);
    }
    if (cur.state === "UNREGISTERED") {
      await this.policies.register(args.projectId, {
        cerbosPolicyRef: `project-${args.projectId}`,
      });
    }
    await this.policies.delegate(args.projectId, {
      graphRootId: args.graphRootId,
    });
    await this.delegationGraph?.grant(args.graphRootId, args.delegateUserId);
    return { state: "DELEGATED", graphRootId: args.graphRootId };
  }
}
