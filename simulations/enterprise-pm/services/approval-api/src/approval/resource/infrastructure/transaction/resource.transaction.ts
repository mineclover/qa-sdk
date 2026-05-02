// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export {
  createResourceTransactionPort,
  createResourceSqliteTransactionPort,
  createResourcePgTransactionPort,
} from "./resource.drizzle-transaction.js";
export type {
  ResourceDialect,
  ResourceTransactionFactoryOpts,
} from "./resource.drizzle-transaction.js";
