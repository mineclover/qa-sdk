// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

export type RequestStatus =
  | "draft" | "submitted" | "in_review"
  | "approved" | "rejected" | "revision_requested";

export type StepDecision = "approved" | "rejected" | "pending";

export interface BudgetRequest {
  id: string;
  projectId: string;
  amount: number;          // 원 단위
  requesterId: string;
  status: RequestStatus;
  currentStage: number;    // 1-based
  totalStages: number;     // determineStages(amount) 결과
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStep {
  requestId: string;
  stageNumber: number;
  approverId: string | null;  // 미할당 시 null
  decision: StepDecision;
  comment: string | null;
  decidedAt: string | null;
}

export interface ResourceRequest {
  id: string;
  projectId: string;
  requesterId: string;
  resourceType: string;       // "consultant" | "equipment" | "license" 등
  description: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimeOffRequest {
  id: string;
  requesterId: string;
  startDate: string;          // ISO date
  endDate: string;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseReport {
  id: string;
  requesterId: string;
  amount: number;
  category: string;
  description: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRequestCreate {
  projectId: string;
  amount: number;
  requesterId: string;
}
export interface ResourceRequestCreate {
  projectId: string;
  requesterId: string;
  resourceType: string;
  description: string;
}
export interface TimeOffRequestCreate {
  requesterId: string;
  startDate: string;
  endDate: string;
  reason: string;
}
export interface ExpenseReportCreate {
  requesterId: string;
  amount: number;
  category: string;
  description: string;
}
