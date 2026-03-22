import { createHash } from "node:crypto";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import {
  InMemoryPrefixRegistry,
  InMemoryVersionLifecycleStore,
  NodeSqliteDriver,
  SqlPrefixRegistry,
  SqlVersionLifecycleStore,
  type SqlDriver,
} from "index-meta";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { createLogger } from "./lib/logger.js";
import { InMemoryPrefixOwnerStore } from "./stores/in-memory-prefix-owner-store.js";
import { SqlPrefixOwnerStore } from "./stores/sql-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "./stores/in-memory-draft-lock-store.js";
import { SqlDraftLockStore } from "./stores/sql-draft-lock-store.js";
import { InMemoryCatalogStore } from "./stores/in-memory-catalog-store.js";
import { SqlCatalogStore } from "./stores/sql-catalog-store.js";
import { InMemoryAxisProfileStore } from "./stores/in-memory-axis-profile-store.js";
import { SqlAxisProfileStore } from "./stores/sql-axis-profile-store.js";
import { REGISTRY_SCHEMA_DDL } from "./stores/schema.sql.js";
import { createActivationGate, type ActivationGatePort } from "./lib/activation-gate-adapter.js";
import { createPostActivationHook } from "./lib/post-activation-hook.js";
import type { PostActivationHookPort } from "./lib/registry-service.js";

const logger = createLogger("registry-service");

/**
 * 멀티 스테이트먼트 DDL을 개별 execute()로 실행한다.
 * SqlDriver.execute()는 단일 스테이트먼트만 지원하므로,
 * 세미콜론으로 분리하여 순차 실행한다.
 */
async function execDdlStatements(
  driver: SqlDriver,
  ddl: string,
): Promise<void> {
  const statements = ddl
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await driver.execute(stmt);
  }
}

async function createStores(sqlitePath: string) {
  if (sqlitePath === ":memory:") {
    return {
      prefixRegistry: new InMemoryPrefixRegistry(),
      versionStore: new InMemoryVersionLifecycleStore(),
      ownerStore: new InMemoryPrefixOwnerStore(),
      lockStore: new InMemoryDraftLockStore(),
      catalogStore: new InMemoryCatalogStore(),
      axisStore: new InMemoryAxisProfileStore(),
    };
  }

  // index-meta DDL (기본 스키마) 적용
  const driver = new NodeSqliteDriver(sqlitePath);
  // registry 전용 테이블 추가 (공개 SqlDriver API 사용)
  await execDdlStatements(driver, REGISTRY_SCHEMA_DDL);

  return {
    prefixRegistry: new SqlPrefixRegistry(driver),
    versionStore: new SqlVersionLifecycleStore(driver),
    ownerStore: new SqlPrefixOwnerStore(driver),
    lockStore: new SqlDraftLockStore(driver),
    catalogStore: new SqlCatalogStore(driver),
    axisStore: new SqlAxisProfileStore(driver),
  };
}

/** CONSTRAINT_GATE_ENABLED=true 시 DKG 기반 활성화 게이트 생성 (동적 import) */
async function buildActivationGate(): Promise<ActivationGatePort | undefined> {
  if (!env.CONSTRAINT_GATE_ENABLED) return undefined;

  try {
    const specCore = await import("@qa-sdk/spec-core/propagation");
    const analysis = await import("@qa-sdk/spec-core/analysis") ;

    // DKG 부트스트랩 — catalog + config 필수
    const { DEMO_CATALOG, DEMO_DKG_CONFIG } = await import("demo-snapshot");
    const graph = analysis.bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

    logger.info({ mode: env.CONSTRAINT_GATE_MODE }, "Activation constraint gate enabled");

    return createActivationGate({
      mode: env.CONSTRAINT_GATE_MODE,
      graphProvider: () => graph,
      checkFn: (g, prefixId, opts) => specCore.checkActivationReadiness(g, prefixId, opts),
    });
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to initialize constraint gate — gate disabled",
    );
    return undefined;
  }
}

/** POST_ACTIVATION_HOOK_ENABLED=true 시 DKG VersionEvent 기록 hook 생성 (동적 import) */
async function buildPostActivationHook(): Promise<PostActivationHookPort | undefined> {
  if (!env.POST_ACTIVATION_HOOK_ENABLED) return undefined;

  try {
    const storeModule = await import("@qa-sdk/spec-core/store") as unknown as import("./types/spec-core-ports.js").StoreModulePort;

    let dkgStore: import("./types/spec-core-ports.js").DkgSqliteStorePort | undefined;
    if (env.POST_ACTIVATION_DKG_PATH) {
      dkgStore = new storeModule.DkgSqliteStore(env.POST_ACTIVATION_DKG_PATH);
    }

    const hook = createPostActivationHook({
      dkgStore,
      logger,
    });

    logger.info("post-activation hook enabled");
    return hook;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to initialize post-activation hook — hook disabled",
    );
    return undefined;
  }
}

/** DEV_DASHBOARD_ENABLED=true 시 개발 대시보드 DKG 프로바이더 생성 */
async function buildDevDashboardProvider() {
  if (!env.DEV_DASHBOARD_ENABLED) return undefined;

  try {
    const { createDevDkgProvider } = await import("./lib/dev-dkg-provider.js");
    const provider = await createDevDkgProvider({
      dkgSqlitePath: env.DEV_DASHBOARD_DKG_PATH,
      logger,
    });
    logger.info("dev dashboard enabled at /dev/");
    return provider;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to initialize dev dashboard — disabled",
    );
    return undefined;
  }
}

/** 콘텐츠의 SHA-256 해시를 구한다 */
function contentHash(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** axis 프로필을 catalog 기준으로 upsert (register 또는 patch) */
async function seedAxisProfiles(
  axisStore: import("./stores/axis-profile-store.js").AxisProfileStore,
  catalog: { axes: Record<string, { name: string; versions: Record<string, { entries?: readonly string[]; capacity?: number }> }> },
) {
  const now = new Date().toISOString();
  for (const [id, axis] of Object.entries(catalog.axes)) {
    const versions = Object.keys(axis.versions);
    const latest = versions[versions.length - 1];
    const snap = (axis.versions as Record<string, { entries?: readonly string[]; capacity?: number }>)[latest];
    const existing = await axisStore.get(id, "demo");
    if (existing) {
      await axisStore.patch(id, "demo", {
        name: axis.name,
        currentVersion: latest ?? "v1",
        capacity: snap?.capacity ?? 32,
        entryCount: snap?.entries?.length ?? 0,
      });
    } else {
      try {
        await axisStore.register({
          id,
          catalogId: "demo",
          name: axis.name,
          currentVersion: latest ?? "v1",
          capacity: snap?.capacity ?? 32,
          entryCount: snap?.entries?.length ?? 0,
          updatedAt: now,
        });
      } catch { /* 중복 무시 */ }
    }
  }
  logger.info({ axes: Object.keys(catalog.axes).length }, "seeded axis profiles");
}

/** DEMO_CATALOG seed — 해시 비교 후 변경 시 자동 업데이트 (auto-reseed) */
async function seedDemoCatalog(
  catalogStore: import("./stores/catalog-store.js").CatalogStore,
  axisStore?: import("./stores/axis-profile-store.js").AxisProfileStore,
) {
  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    const catalogJson = JSON.stringify(DEMO_CATALOG);
    const newHash = contentHash(catalogJson);
    const now = new Date().toISOString();

    const existing = await catalogStore.get("demo");

    if (existing) {
      const existingHash = contentHash(existing.data);
      if (existingHash === newHash) {
        logger.info("DEMO_CATALOG unchanged — skipping seed");
        return;
      }

      // 해시가 다르면 catalog blob 업데이트
      await catalogStore.update("demo", DEMO_CATALOG.name ?? "쇼핑 데모", catalogJson);
      logger.info({ oldHash: existingHash.slice(0, 8), newHash: newHash.slice(0, 8) }, "DEMO_CATALOG updated (hash changed)");

      // axis 프로필도 재동기화
      if (axisStore) {
        await seedAxisProfiles(axisStore, DEMO_CATALOG);
      }
      return;
    }

    // 신규 등록
    await catalogStore.register({
      id: "demo",
      name: DEMO_CATALOG.name ?? "쇼핑 데모",
      data: catalogJson,
      createdAt: now,
      updatedAt: now,
    });

    if (axisStore) {
      await seedAxisProfiles(axisStore, DEMO_CATALOG);
    }

    logger.info("seeded DEMO_CATALOG to catalog store");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to seed DEMO_CATALOG — skipped",
    );
  }
}

/** DkgConfig seed — demo-snapshot에서 DEMO_DKG_CONFIG 로드하여 저장 */
async function seedDkgConfig(configStore: Map<string, string>) {
  try {
    const { DEMO_DKG_CONFIG } = await import("demo-snapshot");
    const configJson = JSON.stringify(DEMO_DKG_CONFIG);
    configStore.set("demo", configJson);
    logger.info("seeded DEMO_DKG_CONFIG to config store");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to seed DEMO_DKG_CONFIG — skipped",
    );
  }
}

async function main() {
  const stores = await createStores(env.SQLITE_PATH);
  const dkgConfigStore = new Map<string, string>();
  await seedDemoCatalog(stores.catalogStore, stores.axisStore);
  await seedDkgConfig(dkgConfigStore);
  const activationGate = await buildActivationGate();
  const postActivationHook = await buildPostActivationHook();
  const devDashboardProvider = await buildDevDashboardProvider();

  const app = createApp({
    ...stores,
    ...(activationGate ? { activationGate } : {}),
    ...(postActivationHook ? { postActivationHook } : {}),
    ...(devDashboardProvider ? { devDashboardProvider } : {}),
    dkgConfigStore,
    logger,
  });

  // WebSocket 설정 (dev-dashboard용)
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  if (devDashboardProvider) {
    const { createDevWsHandler } = await import("./routes/dev-dashboard.js");
    const wsHandler = createDevWsHandler({
      provider: devDashboardProvider,
      catalogStore: stores.catalogStore,
    });
    app.get("/dev/ws", upgradeWebSocket(() => ({
      onOpen(evt: Event, ws: { send(data: string): void }) { wsHandler.onOpen(evt, { send: (d: string) => ws.send(d) }); },
      onMessage(evt: MessageEvent, ws: { send(data: string): void }) { wsHandler.onMessage(evt.data, { send: (d: string) => ws.send(d) }); },
      onClose(evt: CloseEvent, ws: { send(data: string): void }) { wsHandler.onClose(evt, { send: (d: string) => ws.send(d) }); },
      onError(evt: Event, ws: { send(data: string): void }) { wsHandler.onError(evt, { send: (d: string) => ws.send(d) }); },
    })));
    logger.info("dev dashboard WebSocket enabled at /dev/ws");
  }

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info(`registry-service listening on port ${info.port}`);
    warnPortConflict("registry-service", env.PORT, logger);
  });

  injectWebSocket(server);

  installSimpleShutdown({ server, logger });
}

main().catch((err) => {
  logger.error("Failed to start registry-service", err);
  process.exit(1);
});
