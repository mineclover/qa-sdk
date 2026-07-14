// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { UserEntity } from '../../domain/index.js';
import { SqliteUserRepository, PgUserRepository, createUserRepository } from './user.repository.js';
import { SIM_AUTH_USER_SQLITE_DDL } from './sqlite.schema.js';
import * as pgSchemaModule from './pg.schema.js';
import * as sqliteSchemaModule from './sqlite.schema.js';
import type { UserTransactionScope } from '../../application/ports/user-transaction.port.js';

function makeScope(): UserTransactionScope {
  return { id: 'tx-test', startedAt: new Date() };
}

describe('SqliteUserRepository', () => {
  it('save 후 findById 가 entity 를 라운드트립한다', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_AUTH_USER_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteUserRepository(db);
    const entity = UserEntity.create({
      id: 'u_1',
      email: 'u1@example.com',
      displayName: 'U1',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.save(entity, makeScope());
    const found = await repo.findById('u_1');
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(entity.toSnapshot());
    sqlite.close();
  });

  it('findByEmail 라운드트립', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_AUTH_USER_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteUserRepository(db);
    await repo.save(
      UserEntity.create({ id: 'u_2', email: 'u2@example.com', displayName: 'U2' }),
      makeScope(),
    );
    expect((await repo.findByEmail('u2@example.com'))!.id).toBe('u_2');
    expect(await repo.findByEmail('missing@x')).toBeNull();
    sqlite.close();
  });

  it('listByDepartment', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_AUTH_USER_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteUserRepository(db);
    await repo.save(
      UserEntity.create({ id: 'u_3', email: 'u3@x', displayName: 'U3', departmentId: 'dept_a' }),
      makeScope(),
    );
    await repo.save(
      UserEntity.create({ id: 'u_4', email: 'u4@x', displayName: 'U4', departmentId: 'dept_a' }),
      makeScope(),
    );
    await repo.save(
      UserEntity.create({ id: 'u_5', email: 'u5@x', displayName: 'U5', departmentId: 'dept_b' }),
      makeScope(),
    );
    const inA = await repo.listByDepartment('dept_a');
    expect(inA.map((u) => u.id).sort()).toEqual(['u_3', 'u_4']);
    sqlite.close();
  });

  it('delete 후 findById 는 null', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_AUTH_USER_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteUserRepository(db);
    await repo.save(
      UserEntity.create({ id: 'u_6', email: 'u6@x', displayName: 'U6' }),
      makeScope(),
    );
    await repo.delete('u_6', makeScope());
    expect(await repo.findById('u_6')).toBeNull();
    sqlite.close();
  });

  it('upsert: 동일 id save 시 update', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_AUTH_USER_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteUserRepository(db);
    const e1 = UserEntity.create({
      id: 'u_7',
      email: 'u7@x',
      displayName: 'U7',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.save(e1, makeScope());
    const e2 = e1.updateProfile(
      { displayName: 'U7-renamed' },
      new Date('2026-01-02T00:00:00.000Z'),
    );
    await repo.save(e2, makeScope());
    const found = await repo.findById('u_7');
    expect(found!.toSnapshot().displayName).toBe('U7-renamed');
    sqlite.close();
  });
});

describe('PgUserRepository (column mapping symmetry)', () => {
  it('sqlite/pg 둘 다 동일 컬럼셋(JS 필드) 을 사용한다', () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.users);
    const pgCols = Object.keys(pgSchemaModule.users);
    const expected = [
      'id',
      'email',
      'displayName',
      'departmentId',
      'primaryRoleId',
      'createdAt',
      'updatedAt',
    ];
    for (const c of expected) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });
});

describe('createUserRepository factory', () => {
  it('sqlite dialect → SqliteUserRepository', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_AUTH_USER_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createUserRepository({ dialect: 'sqlite', db });
    expect(r).toBeInstanceOf(SqliteUserRepository);
    sqlite.close();
  });

  it('알 수 없는 dialect 는 예외', () => {
    expect(() => createUserRepository({ dialect: 'mysql' as never, db: {} as never })).toThrow();
  });
});
