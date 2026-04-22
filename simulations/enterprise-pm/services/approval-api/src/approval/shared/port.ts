// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import type {
  BudgetRequest,
  BudgetRequestCreate,
  ApprovalStep,
  ResourceRequest,
  ResourceRequestCreate,
  TimeOffRequest,
  TimeOffRequestCreate,
  ExpenseReport,
  ExpenseReportCreate,
  RequestStatus,
  StepDecision,
} from "./types.js";

export interface ApprovalRepository {
  // BudgetRequest
  createBudgetRequest(args: BudgetRequestCreate): Promise<BudgetRequest>;
  findBudgetRequest(id: string): Promise<BudgetRequest | null>;
  listBudgetRequestsByProject(projectId: string): Promise<BudgetRequest[]>;
  listBudgetRequestsByRequester(requesterId: string): Promise<BudgetRequest[]>;
  updateBudgetRequestState(id: string, status: RequestStatus, currentStage: number): Promise<BudgetRequest>;

  // ApprovalStep
  createApprovalSteps(requestId: string, totalStages: number): Promise<ApprovalStep[]>;
  recordDecision(
    requestId: string,
    stageNumber: number,
    approverId: string,
    decision: StepDecision,
    comment?: string,
  ): Promise<ApprovalStep>;
  listSteps(requestId: string): Promise<ApprovalStep[]>;

  // ResourceRequest
  createResourceRequest(args: ResourceRequestCreate): Promise<ResourceRequest>;
  findResourceRequest(id: string): Promise<ResourceRequest | null>;
  updateResourceRequestStatus(id: string, status: RequestStatus): Promise<ResourceRequest>;

  // TimeOffRequest
  createTimeOffRequest(args: TimeOffRequestCreate): Promise<TimeOffRequest>;
  findTimeOffRequest(id: string): Promise<TimeOffRequest | null>;
  updateTimeOffRequestStatus(id: string, status: RequestStatus): Promise<TimeOffRequest>;

  // ExpenseReport
  createExpenseReport(args: ExpenseReportCreate): Promise<ExpenseReport>;
  findExpenseReport(id: string): Promise<ExpenseReport | null>;
  updateExpenseReportStatus(id: string, status: RequestStatus): Promise<ExpenseReport>;
}
