// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createDrizzleOutboxPort, type OutboxPort } from '@qa-sdk/sim-domain-slice-kit';
import { pmOutboxEvents as sqliteProjectOutbox } from '../../../sqlite/schema.js';
import { pmOutboxEvents as pgProjectOutbox } from '../../../pg/schema.js';

export type ProjectDialect = 'sqlite' | 'pg';

export interface ProjectOutboxFactoryOpts {
  readonly dialect: ProjectDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createProjectOutboxPort(opts: ProjectOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === 'sqlite') {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: sqliteProjectOutbox,
    });
  }
  if (opts.dialect === 'pg') {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: pgProjectOutbox,
    });
  }
  throw new Error(
    `createProjectOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
