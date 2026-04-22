// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { Global, Module } from "@nestjs/common";
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
  controllers: [AuditExplorerController],
  providers: [
    AuditExplorerService,
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
  ],
  exports: [AuditExplorerService, AUDIT_RECORDER],
})
export class AuditExplorerModule {}
