// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export {
  createRoleAssignmentTransactionPort,
  createRoleAssignmentSqliteTransactionPort,
  createRoleAssignmentPgTransactionPort,
} from "./role-assignment.drizzle-transaction.js";
export type {
  RoleAssignmentDialect,
  RoleAssignmentTransactionFactoryOpts,
} from "./role-assignment.drizzle-transaction.js";
