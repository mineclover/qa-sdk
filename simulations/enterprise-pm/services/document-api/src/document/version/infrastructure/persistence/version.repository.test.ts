// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { VersionEntity } from '../../domain/index.js';
import { SqliteVersionRepository, createVersionRepository } from './version.repository.js';
import { SIM_DOC_VERSION_SQLITE_DDL } from './sqlite.schema.js';
import * as sqliteSchemaModule from './sqlite.schema.js';
import * as pgSchemaModule from './pg.schema.js';
import type { VersionTransactionScope } from '../../application/ports/version-transaction.port.js';

function makeScope(): VersionTransactionScope {
  return { id: 'tx-test', startedAt: new Date() };
}

function bootstrap() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SIM_DOC_VERSION_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  return { sqlite, db, repo: new SqliteVersionRepository(db) };
}

describe('SqliteVersionRepository', () => {
  it('save 후 findByKey 라운드트립', async () => {
    const { sqlite, repo } = bootstrap();
    const e = VersionEntity.create({
      documentId: 'doc_1',
      versionNumber: 1,
      contentRef: 's3://k1',
      authorId: 'u',
    });
    await repo.save(e, makeScope());
    expect((await repo.findByKey('doc_1', 1))!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });

  it('listByDocument 정렬 (asc by versionNumber)', async () => {
    const { sqlite, repo } = bootstrap();
    await repo.save(
      VersionEntity.create({
        documentId: 'd',
        versionNumber: 2,
        contentRef: 'k2',
        authorId: 'u',
      }),
      makeScope(),
    );
    await repo.save(
      VersionEntity.create({
        documentId: 'd',
        versionNumber: 1,
        contentRef: 'k1',
        authorId: 'u',
      }),
      makeScope(),
    );
    const list = await repo.listByDocument('d');
    expect(list.map((v) => v.versionNumber)).toEqual([1, 2]);
    sqlite.close();
  });

  it('latestVersionNumber — 없으면 0, 있으면 max', async () => {
    const { sqlite, repo } = bootstrap();
    expect(await repo.latestVersionNumber('d')).toBe(0);
    await repo.save(
      VersionEntity.create({ documentId: 'd', versionNumber: 1, contentRef: 'k1', authorId: 'u' }),
      makeScope(),
    );
    await repo.save(
      VersionEntity.create({ documentId: 'd', versionNumber: 2, contentRef: 'k2', authorId: 'u' }),
      makeScope(),
    );
    expect(await repo.latestVersionNumber('d')).toBe(2);
    sqlite.close();
  });
});

describe('Pg/Sqlite column symmetry', () => {
  it('동일 컬럼셋(JS field)', () => {
    const expected = new Set([
      'documentId',
      'versionNumber',
      'contentRef',
      'authorId',
      'createdAt',
    ]);
    for (const c of expected) {
      expect(Object.keys(sqliteSchemaModule.versions)).toContain(c);
      expect(Object.keys(pgSchemaModule.versions)).toContain(c);
    }
  });
});

describe('createVersionRepository factory', () => {
  it('sqlite', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_DOC_VERSION_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    expect(createVersionRepository({ dialect: 'sqlite', db })).toBeInstanceOf(
      SqliteVersionRepository,
    );
    sqlite.close();
  });

  it('unknown dialect → throw', () => {
    expect(() => createVersionRepository({ dialect: 'x' as never, db: {} as never })).toThrow();
  });
});
