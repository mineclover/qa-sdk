// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

/** Read-side detail DTO — command 측 entity 와 독립. */
export interface BudgetDetailReadModel {
  readonly id: string;
  readonly projectId: string;
  readonly projectDepartmentId: string;
  readonly amount: number;
  readonly requesterId: string;
  readonly status: string;
  readonly currentStage: number;
  readonly totalStages: number;
  readonly updatedAt: string;
}

/** approval step 단순 view — listSteps 결과. */
export interface BudgetStepReadModel {
  readonly requestId: string;
  readonly stageNumber: number;
  readonly approverId: string | null;
  readonly decision: "approved" | "rejected" | "pending";
  readonly comment: string | null;
  readonly decidedAt: string | null;
}

/** Read 전용 추상 — primary DB 직접 read 금지, repository 위에 얇게 매핑. */
export abstract class BudgetReadModelQuery {
  abstract findDetail(id: string): Promise<BudgetDetailReadModel | null>;
  abstract listByProject(projectId: string): Promise<BudgetDetailReadModel[]>;
  abstract listByRequester(requesterId: string): Promise<BudgetDetailReadModel[]>;
  abstract listSteps(id: string): Promise<BudgetStepReadModel[]>;
}
