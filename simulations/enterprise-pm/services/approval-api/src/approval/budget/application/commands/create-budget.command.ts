// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

/** 새 budget request 를 생성하라는 명령. */
export interface CreateBudgetCommand {
  readonly id: string;
  readonly projectId: string;
  readonly projectDepartmentId: string;
  readonly amount: number;
  readonly requesterId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
