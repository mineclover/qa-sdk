// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

export {
  createCommentTransactionPort,
  createCommentSqliteTransactionPort,
  createCommentPgTransactionPort,
} from "./comment.drizzle-transaction.js";
export type {
  CommentDialect,
  CommentTransactionFactoryOpts,
} from "./comment.drizzle-transaction.js";
