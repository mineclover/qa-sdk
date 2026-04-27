// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * Re-export of the user slice TransactionPort wiring helpers.
 */
export {
  createUserTransactionPort,
  createUserSqliteTransactionPort,
  createUserPgTransactionPort,
} from "./user.drizzle-transaction.js";
export type {
  UserDialect,
  UserTransactionFactoryOpts,
} from "./user.drizzle-transaction.js";
