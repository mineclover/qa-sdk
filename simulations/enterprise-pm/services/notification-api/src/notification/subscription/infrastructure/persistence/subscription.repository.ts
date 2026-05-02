// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { SubscriptionEntity, matchesEventType } from "../../domain/index.js";
import type { SubscriptionSnapshot } from "../../domain/subscription.types.js";
import { SubscriptionRepositoryPort } from "../../application/ports/subscription-repository.port.js";
import type { SubscriptionTransactionScope } from "../../application/ports/subscription-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface SubscriptionRow {
  userId: string;
  eventType: string;
  channel: "in_app" | "email";
  isActive: boolean;
  createdAt: string;
}

function toSnapshot(row: SubscriptionRow): SubscriptionSnapshot {
  return {
    userId: row.userId,
    eventType: row.eventType,
    channel: row.channel,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function toRow(snapshot: SubscriptionSnapshot): SubscriptionRow {
  return {
    userId: snapshot.userId,
    eventType: snapshot.eventType,
    channel: snapshot.channel,
    isActive: snapshot.isActive,
    createdAt: snapshot.createdAt,
  };
}

export class SqliteSubscriptionRepository extends SubscriptionRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: SubscriptionEntity, _scope: SubscriptionTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.subscriptions)
      .values(row)
      .onConflictDoUpdate({
        target: [sqliteSchema.subscriptions.userId, sqliteSchema.subscriptions.eventType],
        set: { channel: row.channel, isActive: row.isActive },
      });
  }

  async findById(userId: string, eventType: string): Promise<SubscriptionEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.subscriptions)
      .where(
        and(
          eq(sqliteSchema.subscriptions.userId, userId),
          eq(sqliteSchema.subscriptions.eventType, eventType),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return SubscriptionEntity.rehydrate(toSnapshot(rows[0] as SubscriptionRow));
  }

  async listForUser(userId: string): Promise<SubscriptionEntity[]> {
    const rows = (await this.db
      .select()
      .from(sqliteSchema.subscriptions)
      .where(eq(sqliteSchema.subscriptions.userId, userId))) as SubscriptionRow[];
    return rows.map((r) => SubscriptionEntity.rehydrate(toSnapshot(r)));
  }

  async listSubscribersByEventType(eventType: string): Promise<SubscriptionEntity[]> {
    const rows = (await this.db
      .select()
      .from(sqliteSchema.subscriptions)
      .where(eq(sqliteSchema.subscriptions.isActive, true))) as SubscriptionRow[];
    return rows
      .filter((r) => matchesEventType(r.eventType, eventType))
      .map((r) => SubscriptionEntity.rehydrate(toSnapshot(r)));
  }

  async deleteById(
    userId: string,
    eventType: string,
    _scope: SubscriptionTransactionScope,
  ): Promise<void> {
    await this.db
      .delete(sqliteSchema.subscriptions)
      .where(
        and(
          eq(sqliteSchema.subscriptions.userId, userId),
          eq(sqliteSchema.subscriptions.eventType, eventType),
        ),
      );
  }
}

export class PgSubscriptionRepository extends SubscriptionRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: SubscriptionEntity, _scope: SubscriptionTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.subscriptions)
      .values(row)
      .onConflictDoUpdate({
        target: [pgSchema.subscriptions.userId, pgSchema.subscriptions.eventType],
        set: { channel: row.channel, isActive: row.isActive },
      });
  }

  async findById(userId: string, eventType: string): Promise<SubscriptionEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.subscriptions)
      .where(
        and(
          eq(pgSchema.subscriptions.userId, userId),
          eq(pgSchema.subscriptions.eventType, eventType),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return SubscriptionEntity.rehydrate(toSnapshot(rows[0] as SubscriptionRow));
  }

  async listForUser(userId: string): Promise<SubscriptionEntity[]> {
    const rows = (await this.db
      .select()
      .from(pgSchema.subscriptions)
      .where(eq(pgSchema.subscriptions.userId, userId))) as SubscriptionRow[];
    return rows.map((r) => SubscriptionEntity.rehydrate(toSnapshot(r)));
  }

  async listSubscribersByEventType(eventType: string): Promise<SubscriptionEntity[]> {
    const rows = (await this.db
      .select()
      .from(pgSchema.subscriptions)
      .where(eq(pgSchema.subscriptions.isActive, true))) as SubscriptionRow[];
    return rows
      .filter((r) => matchesEventType(r.eventType, eventType))
      .map((r) => SubscriptionEntity.rehydrate(toSnapshot(r)));
  }

  async deleteById(
    userId: string,
    eventType: string,
    _scope: SubscriptionTransactionScope,
  ): Promise<void> {
    await this.db
      .delete(pgSchema.subscriptions)
      .where(
        and(
          eq(pgSchema.subscriptions.userId, userId),
          eq(pgSchema.subscriptions.eventType, eventType),
        ),
      );
  }
}

export type SubscriptionDialect = "sqlite" | "pg";

export interface SubscriptionRepositoryFactoryOpts {
  readonly dialect: SubscriptionDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createSubscriptionRepository(
  opts: SubscriptionRepositoryFactoryOpts,
): SubscriptionRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteSubscriptionRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgSubscriptionRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createSubscriptionRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
