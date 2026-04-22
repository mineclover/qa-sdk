// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { DocumentRepository } from "./shared/port.js";

export type DocumentRepoDialect = "sqlite" | "pg";

export interface DocumentRepoFactoryOpts {
  dialect: DocumentRepoDialect;
  db: BetterSQLite3Database | PostgresJsDatabase;
}

export async function createDocumentRepository(
  opts: DocumentRepoFactoryOpts,
): Promise<DocumentRepository> {
  if (opts.dialect === "sqlite") {
    const { SqliteDocumentRepository } = await import("./sqlite/adapter.js");
    return new SqliteDocumentRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    const { PgDocumentRepository } = await import("./pg/adapter.js");
    return new PgDocumentRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createDocumentRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
