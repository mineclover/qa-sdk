// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export interface ExpenseDetailReadModel {
  readonly id: string;
  readonly requesterId: string;
  readonly amount: number;
  readonly category: string;
  readonly description: string;
  readonly status: string;
  readonly updatedAt: string;
}

export abstract class ExpenseReadModelQuery {
  abstract findDetail(id: string): Promise<ExpenseDetailReadModel | null>;
}
