// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import {
  sqliteDocumentOutboxEvents as sqliteOutbox,
  pgDocumentOutboxEvents as pgOutbox,
} from "../../../shared/outbox/index.js";

/**
 * Comment slice 용 OutboxPort 생성기 — service-wide shared `document_outbox_events`.
 */
export type CommentDialect = "sqlite" | "pg";

export interface CommentOutboxFactoryOpts {
  readonly dialect: CommentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createCommentOutboxPort(opts: CommentOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return createDrizzleOutboxPort({ db: opts.db as never, table: sqliteOutbox });
  }
  if (opts.dialect === "pg") {
    return createDrizzleOutboxPort({ db: opts.db as never, table: pgOutbox });
  }
  throw new Error(
    `createCommentOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
