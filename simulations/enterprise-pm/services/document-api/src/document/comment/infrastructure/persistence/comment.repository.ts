// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { CommentEntity } from "../../domain/index.js";
import type { CommentSnapshot } from "../../domain/index.js";
import { CommentRepositoryPort } from "../../application/ports/comment-repository.port.js";
import type { CommentTransactionScope } from "../../application/ports/comment-transaction.port.js";
import * as sqliteSchema from "./sqlite.schema.js";
import * as pgSchema from "./pg.schema.js";

interface CommentRow {
  id: string;
  documentId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
}

function toSnapshot(row: CommentRow): CommentSnapshot {
  return {
    id: row.id,
    documentId: row.documentId,
    authorId: row.authorId,
    parentCommentId: row.parentCommentId ?? null,
    body: row.body,
    createdAt: row.createdAt,
  };
}

function toRow(snapshot: CommentSnapshot): CommentRow {
  return {
    id: snapshot.id,
    documentId: snapshot.documentId,
    authorId: snapshot.authorId,
    parentCommentId: snapshot.parentCommentId,
    body: snapshot.body,
    createdAt: snapshot.createdAt,
  };
}

export class SqliteCommentRepository extends CommentRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: CommentEntity, _scope: CommentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.comments)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.comments.id,
        set: {
          documentId: row.documentId,
          authorId: row.authorId,
          parentCommentId: row.parentCommentId,
          body: row.body,
        },
      });
  }

  async findById(id: string): Promise<CommentEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.comments)
      .where(eq(sqliteSchema.comments.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return CommentEntity.rehydrate(toSnapshot(rows[0] as CommentRow));
  }

  async listByDocument(documentId: string): Promise<CommentEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.comments)
      .where(eq(sqliteSchema.comments.documentId, documentId));
    return rows.map((r) => CommentEntity.rehydrate(toSnapshot(r as CommentRow)));
  }

  async listReplies(parentCommentId: string): Promise<CommentEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.comments)
      .where(eq(sqliteSchema.comments.parentCommentId, parentCommentId));
    return rows.map((r) => CommentEntity.rehydrate(toSnapshot(r as CommentRow)));
  }

  async delete(id: string, _scope: CommentTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.comments).where(eq(sqliteSchema.comments.id, id));
  }
}

export class PgCommentRepository extends CommentRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: CommentEntity, _scope: CommentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.comments)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.comments.id,
        set: {
          documentId: row.documentId,
          authorId: row.authorId,
          parentCommentId: row.parentCommentId,
          body: row.body,
        },
      });
  }

  async findById(id: string): Promise<CommentEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.comments)
      .where(eq(pgSchema.comments.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return CommentEntity.rehydrate(toSnapshot(rows[0] as CommentRow));
  }

  async listByDocument(documentId: string): Promise<CommentEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.comments)
      .where(eq(pgSchema.comments.documentId, documentId));
    return rows.map((r) => CommentEntity.rehydrate(toSnapshot(r as CommentRow)));
  }

  async listReplies(parentCommentId: string): Promise<CommentEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.comments)
      .where(eq(pgSchema.comments.parentCommentId, parentCommentId));
    return rows.map((r) => CommentEntity.rehydrate(toSnapshot(r as CommentRow)));
  }

  async delete(id: string, _scope: CommentTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.comments).where(eq(pgSchema.comments.id, id));
  }
}

export type CommentDialect = "sqlite" | "pg";

export interface CommentRepositoryFactoryOpts {
  readonly dialect: CommentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createCommentRepository(
  opts: CommentRepositoryFactoryOpts,
): CommentRepositoryPort {
  if (opts.dialect === "sqlite") {
    return new SqliteCommentRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return new PgCommentRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createCommentRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
