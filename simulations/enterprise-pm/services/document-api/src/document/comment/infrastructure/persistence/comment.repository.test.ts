// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { CommentEntity } from '../../domain/index.js';
import { SqliteCommentRepository, createCommentRepository } from './comment.repository.js';
import { SIM_DOC_COMMENT_SQLITE_DDL } from './sqlite.schema.js';
import * as sqliteSchemaModule from './sqlite.schema.js';
import * as pgSchemaModule from './pg.schema.js';
import type { CommentTransactionScope } from '../../application/ports/comment-transaction.port.js';

function makeScope(): CommentTransactionScope {
  return { id: 'tx-test', startedAt: new Date() };
}

function bootstrap() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SIM_DOC_COMMENT_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  return { sqlite, db, repo: new SqliteCommentRepository(db) };
}

describe('SqliteCommentRepository', () => {
  it('save 후 findById 라운드트립', async () => {
    const { sqlite, repo } = bootstrap();
    const e = CommentEntity.create({
      id: 'cmt_1',
      documentId: 'doc_1',
      authorId: 'u',
      body: 'Hi',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.save(e, makeScope());
    expect((await repo.findById('cmt_1'))!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });

  it('listByDocument', async () => {
    const { sqlite, repo } = bootstrap();
    await repo.save(
      CommentEntity.create({ id: 'c1', documentId: 'd1', authorId: 'u', body: 'a' }),
      makeScope(),
    );
    await repo.save(
      CommentEntity.create({ id: 'c2', documentId: 'd1', authorId: 'u', body: 'b' }),
      makeScope(),
    );
    await repo.save(
      CommentEntity.create({ id: 'c3', documentId: 'd2', authorId: 'u', body: 'c' }),
      makeScope(),
    );
    expect((await repo.listByDocument('d1')).length).toBe(2);
    sqlite.close();
  });

  it('listReplies — parentCommentId 기준', async () => {
    const { sqlite, repo } = bootstrap();
    await repo.save(
      CommentEntity.create({ id: 'p1', documentId: 'd', authorId: 'u', body: 'p' }),
      makeScope(),
    );
    await repo.save(
      CommentEntity.create({
        id: 'r1',
        documentId: 'd',
        authorId: 'u',
        body: 'r',
        parentCommentId: 'p1',
      }),
      makeScope(),
    );
    expect((await repo.listReplies('p1')).length).toBe(1);
    sqlite.close();
  });

  it('delete', async () => {
    const { sqlite, repo } = bootstrap();
    await repo.save(
      CommentEntity.create({ id: 'c_d', documentId: 'd', authorId: 'u', body: 'x' }),
      makeScope(),
    );
    await repo.delete('c_d', makeScope());
    expect(await repo.findById('c_d')).toBeNull();
    sqlite.close();
  });
});

describe('Pg/Sqlite column symmetry', () => {
  it('동일 컬럼셋(JS field)', () => {
    const expected = new Set([
      'id',
      'documentId',
      'authorId',
      'parentCommentId',
      'body',
      'createdAt',
    ]);
    for (const c of expected) {
      expect(Object.keys(sqliteSchemaModule.comments)).toContain(c);
      expect(Object.keys(pgSchemaModule.comments)).toContain(c);
    }
  });
});

describe('createCommentRepository factory', () => {
  it('sqlite dialect', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_DOC_COMMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    expect(createCommentRepository({ dialect: 'sqlite', db })).toBeInstanceOf(
      SqliteCommentRepository,
    );
    sqlite.close();
  });

  it('unknown dialect → throw', () => {
    expect(() => createCommentRepository({ dialect: 'x' as never, db: {} as never })).toThrow();
  });
});
