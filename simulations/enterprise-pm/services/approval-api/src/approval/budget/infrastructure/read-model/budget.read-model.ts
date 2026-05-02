// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  BudgetReadModelQuery,
  type BudgetDetailReadModel,
  type BudgetStepReadModel,
} from "../../application/queries/budget-read-model.query.js";
import type { SqliteBudgetRepository, PgBudgetRepository } from "../persistence/budget.repository.js";

/**
 * Step (approval_steps) 의 read-only 조회 추상.
 * approval_steps 는 budget aggregate 외부의 cross-aggregate 테이블 (legacy 공유) 이므로
 * 슬라이스 외부 어댑터 (legacy ApprovalRepository) 가 제공한다.
 */
export interface BudgetStepReader {
  listSteps(requestId: string): Promise<BudgetStepReadModel[]>;
}

/**
 * Repository + StepReader 위에 얇게 얹은 Read Model.
 *
 * Phase 2 의 단순 슬라이스에서는 read model projector 가 없고 entity 를
 * 그대로 detail DTO 로 매핑한다.
 */
export class RepositoryBudgetReadModel extends BudgetReadModelQuery {
  constructor(
    private readonly repository: SqliteBudgetRepository | PgBudgetRepository,
    private readonly steps: BudgetStepReader,
  ) {
    super();
  }

  async findDetail(id: string): Promise<BudgetDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    const s = entity.toSnapshot();
    return {
      id: s.id,
      projectId: s.projectId,
      projectDepartmentId: s.projectDepartmentId,
      amount: s.amount,
      requesterId: s.requesterId,
      status: s.status,
      currentStage: s.currentStage,
      totalStages: s.totalStages,
      updatedAt: s.updatedAt,
    };
  }

  async listByProject(projectId: string): Promise<BudgetDetailReadModel[]> {
    const fn = (this.repository as SqliteBudgetRepository).listByProject;
    if (typeof fn !== "function") return [];
    const entities = await (this.repository as SqliteBudgetRepository).listByProject(projectId);
    return entities.map((e) => {
      const s = e.toSnapshot();
      return {
        id: s.id,
        projectId: s.projectId,
        projectDepartmentId: s.projectDepartmentId,
        amount: s.amount,
        requesterId: s.requesterId,
        status: s.status,
        currentStage: s.currentStage,
        totalStages: s.totalStages,
        updatedAt: s.updatedAt,
      };
    });
  }

  async listByRequester(requesterId: string): Promise<BudgetDetailReadModel[]> {
    const fn = (this.repository as SqliteBudgetRepository).listByRequester;
    if (typeof fn !== "function") return [];
    const entities = await (this.repository as SqliteBudgetRepository).listByRequester(requesterId);
    return entities.map((e) => {
      const s = e.toSnapshot();
      return {
        id: s.id,
        projectId: s.projectId,
        projectDepartmentId: s.projectDepartmentId,
        amount: s.amount,
        requesterId: s.requesterId,
        status: s.status,
        currentStage: s.currentStage,
        totalStages: s.totalStages,
        updatedAt: s.updatedAt,
      };
    });
  }

  listSteps(id: string): Promise<BudgetStepReadModel[]> {
    return this.steps.listSteps(id);
  }
}
