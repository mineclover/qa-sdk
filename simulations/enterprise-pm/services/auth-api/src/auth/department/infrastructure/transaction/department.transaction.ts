// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export {
  createDepartmentTransactionPort,
  createDepartmentSqliteTransactionPort,
  createDepartmentPgTransactionPort,
} from './department.drizzle-transaction.js';
export type {
  DepartmentDialect,
  DepartmentTransactionFactoryOpts,
} from './department.drizzle-transaction.js';
