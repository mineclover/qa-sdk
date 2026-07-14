// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { NotificationEntity } from '../../domain/index.js';
import type { NotificationSnapshot } from '../../domain/notification.types.js';
import type { NotificationStatus } from '../../domain/notification.types.js';
import { NotificationRepositoryPort } from '../../application/ports/notification-repository.port.js';
import type { NotificationTransactionScope } from '../../application/ports/notification-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface NotificationRow {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
}

function toSnapshot(row: NotificationRow): NotificationSnapshot {
  return {
    id: row.id,
    recipientUserId: row.recipientUserId,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    sentAt: row.sentAt ?? null,
    readAt: row.readAt ?? null,
  };
}

function toRow(snapshot: NotificationSnapshot): NotificationRow {
  return {
    id: snapshot.id,
    recipientUserId: snapshot.recipientUserId,
    type: snapshot.type,
    title: snapshot.title,
    body: snapshot.body,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    sentAt: snapshot.sentAt,
    readAt: snapshot.readAt,
  };
}

export class SqliteNotificationRepository extends NotificationRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: NotificationEntity, _scope: NotificationTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.notifications)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.notifications.id,
        set: {
          recipientUserId: row.recipientUserId,
          type: row.type,
          title: row.title,
          body: row.body,
          status: row.status,
          sentAt: row.sentAt,
          readAt: row.readAt,
        },
      });
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.notifications)
      .where(eq(sqliteSchema.notifications.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return NotificationEntity.rehydrate(toSnapshot(rows[0] as NotificationRow));
  }

  async listForUser(
    recipientUserId: string,
    status?: NotificationStatus,
  ): Promise<NotificationEntity[]> {
    const rows = status
      ? await this.db
          .select()
          .from(sqliteSchema.notifications)
          .where(
            and(
              eq(sqliteSchema.notifications.recipientUserId, recipientUserId),
              eq(sqliteSchema.notifications.status, status),
            ),
          )
      : await this.db
          .select()
          .from(sqliteSchema.notifications)
          .where(eq(sqliteSchema.notifications.recipientUserId, recipientUserId));
    return rows.map((r) => NotificationEntity.rehydrate(toSnapshot(r as NotificationRow)));
  }
}

export class PgNotificationRepository extends NotificationRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: NotificationEntity, _scope: NotificationTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.notifications)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.notifications.id,
        set: {
          recipientUserId: row.recipientUserId,
          type: row.type,
          title: row.title,
          body: row.body,
          status: row.status,
          sentAt: row.sentAt,
          readAt: row.readAt,
        },
      });
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.notifications)
      .where(eq(pgSchema.notifications.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return NotificationEntity.rehydrate(toSnapshot(rows[0] as NotificationRow));
  }

  async listForUser(
    recipientUserId: string,
    status?: NotificationStatus,
  ): Promise<NotificationEntity[]> {
    const rows = status
      ? await this.db
          .select()
          .from(pgSchema.notifications)
          .where(
            and(
              eq(pgSchema.notifications.recipientUserId, recipientUserId),
              eq(pgSchema.notifications.status, status),
            ),
          )
      : await this.db
          .select()
          .from(pgSchema.notifications)
          .where(eq(pgSchema.notifications.recipientUserId, recipientUserId));
    return rows.map((r) => NotificationEntity.rehydrate(toSnapshot(r as NotificationRow)));
  }
}

export type NotificationDialect = 'sqlite' | 'pg';

export interface NotificationRepositoryFactoryOpts {
  readonly dialect: NotificationDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createNotificationRepository(
  opts: NotificationRepositoryFactoryOpts,
): NotificationRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteNotificationRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgNotificationRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createNotificationRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
