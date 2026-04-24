// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { Global, Module } from "@nestjs/common";
import { createSimAuthorizationGraphStore } from "@qa-sdk/sim-authorization-graph-provider";
import type { AuthorizationGraphStore } from "authorization-ontology";
import {
  AuditExplorerService,
  AUDIT_RECORDER,
} from "./audit-explorer.service.js";
import { AuditExplorerController } from "./audit-explorer.controller.js";
import { createSimAuditRecorder } from "@qa-sdk/sim-audit-recorder-provider";
import { AUDIT_ENTRIES_DDL } from "audit-recorder-store";
import { createConnection } from "db-bootstrap";
import { env } from "../config/env.js";
import type { AuditRecorder } from "permission-engine";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  AUTHORIZATION_GRAPH_STORE,
  GraphExplorerService,
} from "../graph-explorer/graph-explorer.service.js";
import { GraphExplorerController } from "../graph-explorer/graph-explorer.controller.js";
import {
  GRAPH_RETENTION_HOUSEKEEPING_OPTIONS,
  GraphRetentionHousekeepingService,
} from "../graph-explorer/graph-retention-housekeeping.service.js";
import {
  GRAPH_RETENTION_INSIGHT_ENDPOINT,
  GraphRetentionInsightService,
} from "../graph-explorer/graph-retention-insight.service.js";

/**
 * AUDIT_RECORDER provider — 실 PgAuditRecorder / SqliteAuditRecorder 주입.
 *
 * Plan 12c 의 placeholder (InMemoryAuditRecorder fallback + dialect set 시 throw) 는
 * 완전 제거. 본 module 은 env.QA_DB_DIALECT + connection 정보를 받아 실 DB 연결
 * 후 createSimAuditRecorder 를 호출. (Plan 12c-1)
 *
 * test-bootstrap.ts 는 본 module 을 import 하지 않고 별도 useValue 주입 —
 * 단위 테스트가 외부 recorder 인스턴스를 DI 에 그대로 연결.
 */
@Global()
@Module({
  controllers: [AuditExplorerController, GraphExplorerController],
  providers: [
    AuditExplorerService,
    GraphExplorerService,
    GraphRetentionInsightService,
    GraphRetentionHousekeepingService,
    {
      provide: GRAPH_RETENTION_INSIGHT_ENDPOINT,
      useValue: env.QA_INGEST_URL,
    },
    {
      provide: GRAPH_RETENTION_HOUSEKEEPING_OPTIONS,
      useValue: {
        keepLatest: env.SIM_GRAPH_RETENTION_KEEP_LATEST,
        intervalMs: env.SIM_GRAPH_RETENTION_INTERVAL_MS,
        runOnBoot: env.SIM_GRAPH_RETENTION_RUN_ON_BOOT,
      },
    },
    {
      provide: AUDIT_RECORDER,
      useFactory: async (): Promise<AuditRecorder> => {
        const connection = await createConnection(
          env.QA_DB_DIALECT === "sqlite"
            ? {
                dialect: "sqlite",
                sqlitePath: env.QA_SQLITE_PATH,
              }
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
        // SQLite 경로는 DDL 자동 적용 (in-memory 부팅 대비).
        if (connection.dialect === "sqlite") {
          const raw = (connection.db as BetterSQLite3Database as unknown as {
            $client: { exec: (sql: string) => void };
          }).$client;
          if (raw && typeof raw.exec === "function") {
            raw.exec(AUDIT_ENTRIES_DDL);
          }
        }
        return createSimAuditRecorder({
          dialect: connection.dialect,
          db: connection.db,
        });
      },
    },
    {
      provide: AUTHORIZATION_GRAPH_STORE,
      useFactory: async (): Promise<AuthorizationGraphStore> => {
        const connection = await createConnection(
          env.QA_DB_DIALECT === "sqlite"
            ? {
                dialect: "sqlite",
                sqlitePath: env.QA_SQLITE_PATH,
              }
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
        return createSimAuthorizationGraphStore({
          dialect: connection.dialect,
          db: connection.db,
        });
      },
    },
  ],
  exports: [AuditExplorerService, GraphExplorerService, AUDIT_RECORDER, AUTHORIZATION_GRAPH_STORE],
})
export class AuditExplorerModule {}
