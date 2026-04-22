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
