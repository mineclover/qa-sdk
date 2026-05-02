// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { BudgetEntity } from "../../domain/index.js";
import type { BudgetTransactionScope } from "./budget-transaction.port.js";

/**
 * Budget Aggregate 의 영속 추상.
 *
 * - dialect (sqlite/pg) 무관 — 어댑터에서 분기.
 * - save 는 트랜잭션 스코프를 받아 동일 트랜잭션 내 INSERT/UPDATE.
 */
export abstract class BudgetRepositoryPort {
  abstract save(entity: BudgetEntity, scope: BudgetTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<BudgetEntity | null>;
}
