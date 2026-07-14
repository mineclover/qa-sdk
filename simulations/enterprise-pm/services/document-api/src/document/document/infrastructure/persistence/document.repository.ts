// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DocumentEntity } from '../../domain/index.js';
import type { DocumentSnapshot } from '../../domain/index.js';
import { DocumentRepositoryPort } from '../../application/ports/document-repository.port.js';
import type { DocumentTransactionScope } from '../../application/ports/document-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface DocumentRow {
  id: string;
  projectId: string;
  title: string;
  currentVersion: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

function toSnapshot(row: DocumentRow): DocumentSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    currentVersion: row.currentVersion,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(snapshot: DocumentSnapshot): DocumentRow {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    title: snapshot.title,
    currentVersion: snapshot.currentVersion,
    ownerId: snapshot.ownerId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

export class SqliteDocumentRepository extends DocumentRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: DocumentEntity, _scope: DocumentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(sqliteSchema.documents)
      .values(row)
      .onConflictDoUpdate({
        target: sqliteSchema.documents.id,
        set: {
          projectId: row.projectId,
          title: row.title,
          currentVersion: row.currentVersion,
          ownerId: row.ownerId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.documents)
      .where(eq(sqliteSchema.documents.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return DocumentEntity.rehydrate(toSnapshot(rows[0] as DocumentRow));
  }

  async listByProject(projectId: string): Promise<DocumentEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.documents)
      .where(eq(sqliteSchema.documents.projectId, projectId));
    return rows.map((r) => DocumentEntity.rehydrate(toSnapshot(r as DocumentRow)));
  }

  async delete(id: string, _scope: DocumentTransactionScope): Promise<void> {
    await this.db.delete(sqliteSchema.documents).where(eq(sqliteSchema.documents.id, id));
  }
}

export class PgDocumentRepository extends DocumentRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: DocumentEntity, _scope: DocumentTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db
      .insert(pgSchema.documents)
      .values(row)
      .onConflictDoUpdate({
        target: pgSchema.documents.id,
        set: {
          projectId: row.projectId,
          title: row.title,
          currentVersion: row.currentVersion,
          ownerId: row.ownerId,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.documents)
      .where(eq(pgSchema.documents.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return DocumentEntity.rehydrate(toSnapshot(rows[0] as DocumentRow));
  }

  async listByProject(projectId: string): Promise<DocumentEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.documents)
      .where(eq(pgSchema.documents.projectId, projectId));
    return rows.map((r) => DocumentEntity.rehydrate(toSnapshot(r as DocumentRow)));
  }

  async delete(id: string, _scope: DocumentTransactionScope): Promise<void> {
    await this.db.delete(pgSchema.documents).where(eq(pgSchema.documents.id, id));
  }
}

export type DocumentDialect = 'sqlite' | 'pg';

export interface DocumentRepositoryFactoryOpts {
  readonly dialect: DocumentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createDocumentSliceRepository(
  opts: DocumentRepositoryFactoryOpts,
): DocumentRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteDocumentRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgDocumentRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createDocumentSliceRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
