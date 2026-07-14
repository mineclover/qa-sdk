// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export {
  createExpenseTransactionPort,
  createExpenseSqliteTransactionPort,
  createExpensePgTransactionPort,
} from './expense.drizzle-transaction.js';
export type {
  ExpenseDialect,
  ExpenseTransactionFactoryOpts,
} from './expense.drizzle-transaction.js';
