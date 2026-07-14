// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export * as sqliteExpenseSchema from './sqlite.schema.js';
export * as pgExpenseSchema from './pg.schema.js';

export { SIM_APPROVAL_EXPENSE_SQLITE_DDL } from './sqlite.schema.js';
export { SIM_APPROVAL_EXPENSE_PG_DDL } from './pg.schema.js';
