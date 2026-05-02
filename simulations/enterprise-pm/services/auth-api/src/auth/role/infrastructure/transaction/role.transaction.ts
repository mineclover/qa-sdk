// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export {
  createRoleTransactionPort,
  createRoleSqliteTransactionPort,
  createRolePgTransactionPort,
} from "./role.drizzle-transaction.js";
export type {
  RoleDialect,
  RoleTransactionFactoryOpts,
} from "./role.drizzle-transaction.js";
