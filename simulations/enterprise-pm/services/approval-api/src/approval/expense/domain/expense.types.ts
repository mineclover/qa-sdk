// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ExpenseReportId, RequesterId } from "./expense.ids.js";

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "revision_requested";

export interface ExpenseProps {
  readonly id: ExpenseReportId;
  readonly requesterId: RequesterId;
  readonly amount: number;
  readonly category: string;
  readonly description: string;
  readonly status: ExpenseStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ExpenseSnapshot {
  readonly id: string;
  readonly requesterId: string;
  readonly amount: number;
  readonly category: string;
  readonly description: string;
  readonly status: ExpenseStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
