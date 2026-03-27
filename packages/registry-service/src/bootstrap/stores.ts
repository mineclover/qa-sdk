import {
  InMemoryPrefixRegistry,
  InMemoryVersionLifecycleStore,
  NodeSqliteDriver,
  SqlPrefixRegistry,
  SqlVersionLifecycleStore,
} from "index-meta";
import type { SqlDriver } from "index-meta";
import { InMemoryPrefixOwnerStore } from "../stores/in-memory-prefix-owner-store.js";
import { SqlPrefixOwnerStore } from "../stores/sql-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "../stores/in-memory-draft-lock-store.js";
import { SqlDraftLockStore } from "../stores/sql-draft-lock-store.js";
import { InMemoryCatalogStore } from "../stores/in-memory-catalog-store.js";
import { SqlCatalogStore } from "../stores/sql-catalog-store.js";
import { InMemoryAxisProfileStore } from "../stores/in-memory-axis-profile-store.js";
import { SqlAxisProfileStore } from "../stores/sql-axis-profile-store.js";
import { REGISTRY_SCHEMA_DDL, REGISTRY_MIGRATIONS } from "../stores/schema.sql.js";
import { runMigrations } from "../stores/migrate.js";

type MigrationLogger = Parameters<typeof runMigrations>[2];

/**
 * 멀티 스테이트먼트 DDL을 개별 execute()로 실행한다.
 * SqlDriver.execute()는 단일 스테이트먼트만 지원하므로,
 * 세미콜론으로 분리하여 순차 실행한다.
 */
export async function execDdlStatements(
  driver: SqlDriver,
  ddl: string,
): Promise<void> {
  const statements = ddl
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await driver.execute(statement);
  }
}

export async function createRegistryDatabaseDriver(
  sqlitePath: string,
  logger?: MigrationLogger,
): Promise<NodeSqliteDriver> {
  const driver = new NodeSqliteDriver(sqlitePath);
  await execDdlStatements(driver, REGISTRY_SCHEMA_DDL);
  await runMigrations(driver, REGISTRY_MIGRATIONS, logger);
  return driver;
}

export async function createRegistryStores(sqlitePath: string, logger?: MigrationLogger) {
  if (sqlitePath === ":memory:") {
    const { InMemoryConfigStore } = await import("../stores/in-memory-config-store.js");
    const { InMemoryServiceEndpointStore } = await import("../stores/in-memory-service-endpoint-store.js");
    const { InMemoryEventSchemaStore } = await import("../stores/in-memory-event-schema-store.js");

    return {
      prefixRegistry: new InMemoryPrefixRegistry(),
      versionStore: new InMemoryVersionLifecycleStore(),
      ownerStore: new InMemoryPrefixOwnerStore(),
      lockStore: new InMemoryDraftLockStore(),
      catalogStore: new InMemoryCatalogStore(),
      axisStore: new InMemoryAxisProfileStore(),
      configStore: new InMemoryConfigStore(),
      endpointStore: new InMemoryServiceEndpointStore(),
      eventSchemaStore: new InMemoryEventSchemaStore(),
    };
  }

  const driver = await createRegistryDatabaseDriver(sqlitePath, logger);
  const { SqlConfigStore } = await import("../stores/sql-config-store.js");
  const { SqlServiceEndpointStore } = await import("../stores/sql-service-endpoint-store.js");
  const { SqlEventSchemaStore } = await import("../stores/sql-event-schema-store.js");

  return {
    prefixRegistry: new SqlPrefixRegistry(driver),
    versionStore: new SqlVersionLifecycleStore(driver),
    ownerStore: new SqlPrefixOwnerStore(driver),
    lockStore: new SqlDraftLockStore(driver),
    catalogStore: new SqlCatalogStore(driver),
    axisStore: new SqlAxisProfileStore(driver),
    configStore: new SqlConfigStore(driver),
    endpointStore: new SqlServiceEndpointStore(driver),
    eventSchemaStore: new SqlEventSchemaStore(driver),
  };
}
