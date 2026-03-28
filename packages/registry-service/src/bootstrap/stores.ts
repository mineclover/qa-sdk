import {
  InMemoryPrefixRegistry,
  InMemoryVersionLifecycleStore,
  NodeSqliteDriver,
  SqlPrefixRegistry,
  SqlVersionLifecycleStore,
} from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { InMemoryPrefixOwnerStore } from "../stores/in-memory-prefix-owner-store.js";
import { SqlPrefixOwnerStore } from "../stores/sql-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "../stores/in-memory-draft-lock-store.js";
import { SqlDraftLockStore } from "../stores/sql-draft-lock-store.js";
import { InMemoryCatalogStore } from "../stores/in-memory-catalog-store.js";
import { SqlCatalogStore } from "../stores/sql-catalog-store.js";
import { InMemoryAxisProfileStore } from "../stores/in-memory-axis-profile-store.js";
import { SqlAxisProfileStore } from "../stores/sql-axis-profile-store.js";
const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

export async function createRegistryDatabaseDriver(
  sqlitePath: string,
): Promise<NodeSqliteDriver> {
  // NodeSqliteDriver 기본 생성 (index-meta SCHEMA_DDL 자동 적용)
  // → drizzle migrate로 registry 전용 테이블 추가 적용
  // NodeSqliteDriver 기본 생성 → index-meta 스키마 drizzle migrate 자동 적용
  // (PRAGMA WAL + busy_timeout + foreign_keys도 constructor에서 설정됨)
  const driver = new NodeSqliteDriver(sqlitePath);
  // registry 전용 테이블 추가 마이그레이션
  try {
    const drizzleDb = drizzle({ client: driver.$client });
    migrate(drizzleDb, { migrationsFolder });
  } catch (err) {
    console.error("[registry-service] drizzle 마이그레이션 실패:", err);
    throw err;
  }
  return driver;
}

export async function createRegistryStores(sqlitePath: string) {
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

  const driver = await createRegistryDatabaseDriver(sqlitePath);
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
