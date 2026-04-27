// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { Global, Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
} from "@qa-sdk/sim-domain-slice-kit";
import { createSimAuthorizationGraphStore } from "@qa-sdk/sim-authorization-graph-provider";
import { createConnection } from "db-bootstrap";
import type { AuthorizationGraphStore } from "authorization-ontology";

import { env } from "../config/env.js";
import { GraphStoreQueryPort } from "./application/ports/graph-store-query.port.js";
import { GraphStoreQueryAdapter } from "./infrastructure/adapters/graph-store-query.adapter.js";
import { createGraphExplorerLogger } from "./infrastructure/logging/graph-explorer.logger.js";
import {
  GRAPH_RETENTION_HOUSEKEEPING_OPTIONS,
  GraphRetentionHousekeepingService,
  type GraphRetentionHousekeepingOptions,
} from "./infrastructure/housekeeping/graph-retention-housekeeping.service.js";
import { GraphCatalogBff } from "./presentation/bff/graph-catalog.bff.js";
import { GraphCatalogController } from "./presentation/bff/graph-catalog.controller.js";

/** 외부 인스턴스 토큰 — test-bootstrap 가 같은 토큰으로 useValue 주입. */
export const AUTHORIZATION_GRAPH_STORE = Symbol.for(
  "sim-audit-browser-api/graph-explorer/AuthorizationGraphStore",
);

const authorizationGraphStoreProvider: Provider = {
  provide: AUTHORIZATION_GRAPH_STORE,
  useFactory: async (): Promise<AuthorizationGraphStore> => {
    const connection = await createConnection(
      env.QA_DB_DIALECT === "sqlite"
        ? { dialect: "sqlite", sqlitePath: env.QA_SQLITE_PATH }
        : {
            dialect: "pg",
            pgHost: env.QA_PG_HOST!,
            pgPort: env.QA_PG_PORT!,
            pgDatabase: env.QA_PG_DATABASE!,
            pgUser: env.QA_PG_USER!,
            pgPassword: env.QA_PG_PASSWORD!,
            pgSchema: env.QA_PG_SCHEMA ?? "sim",
          },
    );
    return createSimAuthorizationGraphStore({ dialect: connection.dialect, db: connection.db });
  },
};

const graphStoreQueryProvider: Provider = {
  provide: GraphStoreQueryPort,
  useFactory: (store: AuthorizationGraphStore) => new GraphStoreQueryAdapter(store),
  inject: [AUTHORIZATION_GRAPH_STORE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createGraphExplorerLogger(),
};

const housekeepingOptionsProvider: Provider = {
  provide: GRAPH_RETENTION_HOUSEKEEPING_OPTIONS,
  useValue: {
    keepLatest: env.SIM_GRAPH_RETENTION_KEEP_LATEST,
    intervalMs: env.SIM_GRAPH_RETENTION_INTERVAL_MS,
    runOnBoot: env.SIM_GRAPH_RETENTION_RUN_ON_BOOT,
  } satisfies GraphRetentionHousekeepingOptions,
};

const bffProvider: Provider = {
  provide: GraphCatalogBff,
  useFactory: (graphs: GraphStoreQueryPort, logger: LoggerPort) =>
    new GraphCatalogBff(graphs, logger),
  inject: [GraphStoreQueryPort, SLICE_LOGGER_PORT],
};

/**
 * Graph Explorer 슬라이스의 NestJS 모듈 (BFF 슬라이스).
 *
 * - aggregate / write 없음 — read + maintenance prune 만
 * - SLICE_LOGGER_PORT 를 본 모듈 안에서 직접 provide
 * - AUTHORIZATION_GRAPH_STORE 외부 인스턴스 토큰 (test override 가능)
 * - GraphRetentionHousekeepingService — 부팅/주기 retention sweep
 */
@Global()
@Module({
  providers: [
    authorizationGraphStoreProvider,
    graphStoreQueryProvider,
    loggerProvider,
    housekeepingOptionsProvider,
    GraphRetentionHousekeepingService,
    bffProvider,
  ],
  controllers: [GraphCatalogController],
  exports: [GraphStoreQueryPort, GraphCatalogBff, AUTHORIZATION_GRAPH_STORE],
})
export class GraphExplorerSliceModule {}
