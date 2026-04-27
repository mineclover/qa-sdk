// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  ExpenseReadModelQuery,
  type ExpenseDetailReadModel,
} from "../../application/queries/expense-read-model.query.js";
import type { ExpenseRepositoryPort } from "../../application/ports/expense-repository.port.js";

export class RepositoryExpenseReadModel extends ExpenseReadModelQuery {
  constructor(private readonly repository: ExpenseRepositoryPort) {
    super();
  }
  async findDetail(id: string): Promise<ExpenseDetailReadModel | null> {
    const e = await this.repository.findById(id);
    if (!e) return null;
    const s = e.toSnapshot();
    return {
      id: s.id,
      requesterId: s.requesterId,
      amount: s.amount,
      category: s.category,
      description: s.description,
      status: s.status,
      updatedAt: s.updatedAt,
    };
  }
}
