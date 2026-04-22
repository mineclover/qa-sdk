// @def.boundary db-bootstrap
// @def.doc db-bootstrap

export {
  createConnection,
  type Connection,
  type ConnectionConfig,
  type DialectKind,
  type PgConfig,
  type SqliteConfig,
} from "./connection.js";

export {
  createSqliteTestFixture,
  createPgTestFixture,
  type SqliteFixture,
  type PgFixture,
  type PgFixtureConfig,
} from "./test-fixtures.js";

export {
  dbEnvSchema,
  parseDbEnv,
  type DbEnv,
  type ParsedDbEnv,
} from "./env.js";

// Plan 15c — RLS session context
export {
  type RlsSessionContext,
  type RlsTxRunner,
  type RlsTxSql,
  EMPTY_RLS_CONTEXT,
  MAX_BITMAP_BYTES,
  BitmapTooLargeError,
  encodeBitmapHex,
  createRlsTxRunner,
} from "./rls-session.js";

export { withRlsContext, getCurrentRlsContext } from "./rls-context-storage.js";

export {
  RlsContextInterceptor,
  claimsToRlsContext,
  decodeBitmapHex,
  type RlsJwtClaims,
} from "./rls-nest-interceptor.js";

// Plan 15d — Shadow mode predictor
export {
  predictRlsDecision,
  type RlsShadowQuery,
  type RlsWouldDecision,
  type RlsShadowPrediction,
} from "./rls-shadow-evaluator.js";
