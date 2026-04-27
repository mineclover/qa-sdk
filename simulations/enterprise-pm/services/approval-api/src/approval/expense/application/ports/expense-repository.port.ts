// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ExpenseEntity } from "../../domain/index.js";
import type { ExpenseTransactionScope } from "./expense-transaction.port.js";

export abstract class ExpenseRepositoryPort {
  abstract save(entity: ExpenseEntity, scope: ExpenseTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<ExpenseEntity | null>;
}
