// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { and, asc, desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { VersionEntity } from '../../domain/index.js';
import type { VersionSnapshot } from '../../domain/index.js';
import { VersionRepositoryPort } from '../../application/ports/version-repository.port.js';
import type { VersionTransactionScope } from '../../application/ports/version-transaction.port.js';
import * as sqliteSchema from './sqlite.schema.js';
import * as pgSchema from './pg.schema.js';

interface VersionRow {
  documentId: string;
  versionNumber: number;
  contentRef: string;
  authorId: string;
  createdAt: string;
}

function toSnapshot(row: VersionRow): VersionSnapshot {
  return {
    documentId: row.documentId,
    versionNumber: row.versionNumber,
    contentRef: row.contentRef,
    authorId: row.authorId,
    createdAt: row.createdAt,
  };
}

function toRow(s: VersionSnapshot): VersionRow {
  return {
    documentId: s.documentId,
    versionNumber: s.versionNumber,
    contentRef: s.contentRef,
    authorId: s.authorId,
    createdAt: s.createdAt,
  };
}

export class SqliteVersionRepository extends VersionRepositoryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }

  async save(entity: VersionEntity, _scope: VersionTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db.insert(sqliteSchema.versions).values(row);
  }

  async findByKey(documentId: string, versionNumber: number): Promise<VersionEntity | null> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.versions)
      .where(
        and(
          eq(sqliteSchema.versions.documentId, documentId),
          eq(sqliteSchema.versions.versionNumber, versionNumber),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return VersionEntity.rehydrate(toSnapshot(rows[0] as VersionRow));
  }

  async listByDocument(documentId: string): Promise<VersionEntity[]> {
    const rows = await this.db
      .select()
      .from(sqliteSchema.versions)
      .where(eq(sqliteSchema.versions.documentId, documentId))
      .orderBy(asc(sqliteSchema.versions.versionNumber));
    return rows.map((r) => VersionEntity.rehydrate(toSnapshot(r as VersionRow)));
  }

  async latestVersionNumber(documentId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sqliteSchema.versions.versionNumber })
      .from(sqliteSchema.versions)
      .where(eq(sqliteSchema.versions.documentId, documentId))
      .orderBy(desc(sqliteSchema.versions.versionNumber))
      .limit(1);
    return rows.length === 0 ? 0 : (rows[0] as { n: number }).n;
  }
}

export class PgVersionRepository extends VersionRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(entity: VersionEntity, _scope: VersionTransactionScope): Promise<void> {
    const row = toRow(entity.toSnapshot());
    await this.db.insert(pgSchema.versions).values(row);
  }

  async findByKey(documentId: string, versionNumber: number): Promise<VersionEntity | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.versions)
      .where(
        and(
          eq(pgSchema.versions.documentId, documentId),
          eq(pgSchema.versions.versionNumber, versionNumber),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return VersionEntity.rehydrate(toSnapshot(rows[0] as VersionRow));
  }

  async listByDocument(documentId: string): Promise<VersionEntity[]> {
    const rows = await this.db
      .select()
      .from(pgSchema.versions)
      .where(eq(pgSchema.versions.documentId, documentId))
      .orderBy(asc(pgSchema.versions.versionNumber));
    return rows.map((r) => VersionEntity.rehydrate(toSnapshot(r as VersionRow)));
  }

  async latestVersionNumber(documentId: string): Promise<number> {
    const rows = await this.db
      .select({ n: pgSchema.versions.versionNumber })
      .from(pgSchema.versions)
      .where(eq(pgSchema.versions.documentId, documentId))
      .orderBy(desc(pgSchema.versions.versionNumber))
      .limit(1);
    return rows.length === 0 ? 0 : (rows[0] as { n: number }).n;
  }
}

export type VersionDialect = 'sqlite' | 'pg';

export interface VersionRepositoryFactoryOpts {
  readonly dialect: VersionDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createVersionRepository(opts: VersionRepositoryFactoryOpts): VersionRepositoryPort {
  if (opts.dialect === 'sqlite') {
    return new SqliteVersionRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return new PgVersionRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createVersionRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
