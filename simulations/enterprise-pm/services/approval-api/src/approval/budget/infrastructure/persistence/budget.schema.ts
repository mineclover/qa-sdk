// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

/**
 * Dialect-aggregating re-export — sqlite + pg dialect 분리.
 */
export * as sqliteBudgetSchema from "./sqlite.schema.js";
export * as pgBudgetSchema from "./pg.schema.js";

export { SIM_APPROVAL_BUDGET_SQLITE_DDL } from "./sqlite.schema.js";
export { SIM_APPROVAL_BUDGET_PG_DDL } from "./pg.schema.js";
