// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * Re-export of the assignment slice TransactionPort wiring helpers.
 *
 * 호출자는 일반 시나리오에서 `createAssignmentTransactionPort({ dialect, db })`
 * 만 사용하면 된다. drizzle-specific 한 헬퍼가 필요하면
 * `assignment.drizzle-transaction.ts` 를 직접 import.
 */
export {
  createAssignmentTransactionPort,
  createAssignmentSqliteTransactionPort,
  createAssignmentPgTransactionPort,
} from './assignment.drizzle-transaction.js';
export type {
  AssignmentDialect,
  AssignmentTransactionFactoryOpts,
} from './assignment.drizzle-transaction.js';
