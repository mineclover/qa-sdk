// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createConnection } from "db-bootstrap";
import { env } from "../config/env.js";
import { SIM_DOC_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_DOC_PG_DDL } from "./pg/schema.js";
import {
  SIM_DOC_OUTBOX_SQLITE_DDL,
  SIM_DOC_OUTBOX_PG_DDL,
} from "./shared/outbox/index.js";

export const DOCUMENT_DB_INSTANCE = Symbol("DOCUMENT_DB_INSTANCE");

export interface DocumentDbInstanceHandle {
  dialect: "sqlite" | "pg";
  db: BetterSQLite3Database | PostgresJsDatabase;
}

/**
 * document-api 의 모든 슬라이스가 공유하는 service-wide DB handle.
 *
 * - 본 테이블 (`documents`, `document_versions`, `comments`) 은 SIM_DOC_*_DDL 이 정의.
 * - service-wide shared outbox (`document_outbox_events`) 은 SIM_DOC_OUTBOX_*_DDL 이 정의.
 */
async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === "sqlite") {
    const raw = (conn.db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === "function") {
      raw.exec(SIM_DOC_SQLITE_DDL);
      raw.exec(SIM_DOC_OUTBOX_SQLITE_DDL);
    }
    return;
  }
  const raw = (conn.db as unknown as { $client: unknown }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === "function") {
    await raw.unsafe(SIM_DOC_PG_DDL);
    await raw.unsafe(SIM_DOC_OUTBOX_PG_DDL);
  }
}

@Module({})
export class DocumentDbModule {
  static forRoot(): DynamicModule {
    const dbInstanceProvider: Provider = {
      provide: DOCUMENT_DB_INSTANCE,
      useFactory: async (): Promise<DocumentDbInstanceHandle> => {
        const conn = await createConnection(
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
        await applyDdl(conn);
        return {
          dialect: conn.dialect,
          db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
        };
      },
    };
    return {
      module: DocumentDbModule,
      providers: [dbInstanceProvider],
      exports: [DOCUMENT_DB_INSTANCE],
      global: true,
    };
  }
}
