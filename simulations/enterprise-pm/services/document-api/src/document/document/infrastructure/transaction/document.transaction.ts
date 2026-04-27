// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

export {
  createDocumentTransactionPort,
  createDocumentSqliteTransactionPort,
  createDocumentPgTransactionPort,
} from "./document.drizzle-transaction.js";
export type {
  DocumentDialect,
  DocumentTransactionFactoryOpts,
} from "./document.drizzle-transaction.js";
