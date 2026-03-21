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

    // DKG 부트스트랩 — catalog + config 기본값 사용
    const graph = analysis.bootstrapDkg();

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

/** DEMO_CATALOG이 store에 없으면 seed (catalog blob + prefix/axis 프로필) */
async function seedDemoCatalog(
  catalogStore: import("./stores/catalog-store.js").CatalogStore,
  axisStore?: import("./stores/axis-profile-store.js").AxisProfileStore,
) {
  const existing = await catalogStore.get("demo");
  if (existing) return;

  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    const now = new Date().toISOString();

    // 1. catalog blob seed (하위 호환)
    await catalogStore.register({
      id: "demo",
      name: DEMO_CATALOG.name ?? "쇼핑 데모",
      data: JSON.stringify(DEMO_CATALOG),
      createdAt: now,
      updatedAt: now,
    });

    // 2. axis 프로필 개별 seed
    if (axisStore) {
      for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
        const versions = Object.keys(axis.versions);
        const latest = versions[versions.length - 1];
        const snap = (axis.versions as Record<string, { entries?: readonly string[]; capacity?: number }>)[latest];
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
      logger.info({ axes: Object.keys(DEMO_CATALOG.axes).length }, "seeded axis profiles");
    }

    logger.info("seeded DEMO_CATALOG to catalog store");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to seed DEMO_CATALOG — skipped",
    );
  }
}

async function main() {
  const stores = await createStores(env.SQLITE_PATH);
  await seedDemoCatalog(stores.catalogStore, stores.axisStore);
  const activationGate = await buildActivationGate();
  const postActivationHook = await buildPostActivationHook();
  const devDashboardProvider = await buildDevDashboardProvider();

  const app = createApp({
    ...stores,
    ...(activationGate ? { activationGate } : {}),
    ...(postActivationHook ? { postActivationHook } : {}),
    ...(devDashboardProvider ? { devDashboardProvider } : {}),
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
    warnPortConflict(env.PORT);
  });

  injectWebSocket(server);

  function shutdown(signal: string) {
    logger.info({ signal }, "shutdown requested");
    server.close(() => {
      logger.info("shutdown complete");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

function warnPortConflict(port: number) {
  const known: Record<string, number> = { "registry-server": 3100, "ingest-server": 3200, "registry-service": 3300, "gate-service": 3400, "query-service": 3500, "decode-service": 3600 };
  for (const [name, p] of Object.entries(known)) {
    if (name !== "registry-service" && p === port) logger.warn(`⚠ PORT ${port} conflicts with ${name} (default: ${p}). Set PORT env to avoid collision.`);
  }
}

main().catch((err) => {
  logger.error("Failed to start registry-service", err);
  process.exit(1);
});
