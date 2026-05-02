// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export interface CreateExpenseCommand {
  readonly id: string;
  readonly requesterId: string;
  readonly amount: number;
  readonly category: string;
  readonly description: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
