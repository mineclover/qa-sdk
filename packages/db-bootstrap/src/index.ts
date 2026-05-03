// @def.boundary db-bootstrap
// @def.doc db-bootstrap

export {
  createConnection,
  createDualConnection,
  type Connection,
  type ConnectionConfig,
  type DialectKind,
  type DualConnection,
  type DualConnectionConfig,
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
  parsePgUrl,
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

export {
  RlsShadowInterceptor,
  RlsShadow,
  RLS_SHADOW_META,
  type RlsShadowRecorder,
} from "./rls-shadow-interceptor.js";

// Plan 15e — admin bypass connection
export {
  createAdminBypassConnection,
  type AdminBypassConnectionConfig,
  type AdminBypassConnection,
} from "./admin-bypass.js";
