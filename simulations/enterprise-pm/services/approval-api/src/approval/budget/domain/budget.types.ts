// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type {
  BudgetRequestId,
  DepartmentId,
  ProjectId,
  RequesterId,
} from "./budget.ids.js";

/** 상태 머신 — budget 라이프사이클의 유한 상태. */
export type BudgetStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "revision_requested";

/** 도메인 entity 의 내부 props (불변, branded ids). */
export interface BudgetProps {
  readonly id: BudgetRequestId;
  readonly projectId: ProjectId;
  readonly projectDepartmentId: DepartmentId;
  readonly amount: number;
  readonly requesterId: RequesterId;
  readonly status: BudgetStatus;
  readonly currentStage: number;
  readonly totalStages: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 영속/와이어 직렬화 형 — branding 제거, ISO 문자열. */
export interface BudgetSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly projectDepartmentId: string;
  readonly amount: number;
  readonly requesterId: string;
  readonly status: BudgetStatus;
  readonly currentStage: number;
  readonly totalStages: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
