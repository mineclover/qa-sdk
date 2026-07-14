// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ProjectEntity } from '../../domain/index.js';
import { SqliteProjectRepository, createProjectRepository } from './project.repository.js';
import { SIM_PM_SQLITE_DDL } from '../../../sqlite/schema.js';
import type { ProjectTransactionScope } from '../../application/ports/project-transaction.port.js';

function makeScope(): ProjectTransactionScope {
  return { id: 'tx-test', startedAt: new Date() };
}

describe('SqliteProjectRepository', () => {
  it('save 후 findById 라운드트립', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteProjectRepository(db);
    const e = ProjectEntity.create({
      id: 'prj_1',
      name: 'Demo',
      ownerId: 'u_1',
      departmentId: 'd_1',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.save(e, makeScope());

    const found = await repo.findById('prj_1');
    expect(found?.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });

  it('listByDepartment + listByOwner', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteProjectRepository(db);
    await repo.save(
      ProjectEntity.create({ id: 'p1', name: 'A', ownerId: 'u1', departmentId: 'd1' }),
      makeScope(),
    );
    await repo.save(
      ProjectEntity.create({ id: 'p2', name: 'B', ownerId: 'u1', departmentId: 'd2' }),
      makeScope(),
    );
    expect((await repo.listByOwner('u1')).length).toBe(2);
    expect((await repo.listByDepartment('d1')).length).toBe(1);
    sqlite.close();
  });

  it('delete — row 제거', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteProjectRepository(db);
    await repo.save(
      ProjectEntity.create({ id: 'px', name: 'X', ownerId: 'u', departmentId: 'd' }),
      makeScope(),
    );
    await repo.delete('px', makeScope());
    expect(await repo.findById('px')).toBeNull();
    sqlite.close();
  });
});

describe('createProjectRepository factory', () => {
  it('sqlite dialect → SqliteProjectRepository', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createProjectRepository({ dialect: 'sqlite', db });
    expect(r).toBeInstanceOf(SqliteProjectRepository);
    sqlite.close();
  });

  it('알 수 없는 dialect 는 예외', () => {
    expect(() => createProjectRepository({ dialect: 'mysql' as never, db: {} as never })).toThrow();
  });
});
