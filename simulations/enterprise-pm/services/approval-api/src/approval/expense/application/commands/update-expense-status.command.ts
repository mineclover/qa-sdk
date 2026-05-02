// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ExpenseStatus } from "../../domain/index.js";

export interface UpdateExpenseStatusCommand {
  readonly id: string;
  readonly status: ExpenseStatus;
  readonly traceId?: string;
  readonly correlationId?: string;
}
