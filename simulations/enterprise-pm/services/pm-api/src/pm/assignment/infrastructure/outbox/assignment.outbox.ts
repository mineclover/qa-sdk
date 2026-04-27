// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import { assignmentOutbox as sqliteAssignmentOutbox } from "../persistence/sqlite.schema.js";
import { assignmentOutbox as pgAssignmentOutbox } from "../persistence/pg.schema.js";

/**
 * Assignment slice 용 OutboxPort 생성기.
 *
 * - dialect 별 drizzle table 을 선택해 kit 의 createDrizzleOutboxPort 에 위임.
 * - 컬럼명은 snake_case (aggregate_id, event_name, ...) — kit 어댑터가 그대로
 *   row 에 채워 넣는다.
 */
export type AssignmentDialect = "sqlite" | "pg";

export interface AssignmentOutboxFactoryOpts {
  readonly dialect: AssignmentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createAssignmentOutboxPort(opts: AssignmentOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: sqliteAssignmentOutbox,
    });
  }
  if (opts.dialect === "pg") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: pgAssignmentOutbox,
    });
  }
  throw new Error(
    `createAssignmentOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
