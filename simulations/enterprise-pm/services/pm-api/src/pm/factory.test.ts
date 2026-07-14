import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createPmRepository } from './factory.js';
import { SIM_PM_SQLITE_DDL } from './sqlite/schema.js';

describe('createPmRepository', () => {
  it('sqlite dialect → SqlitePmRepository', async () => {
    const raw = new Database(':memory:');
    raw.exec(SIM_PM_SQLITE_DDL);
    const repo = await createPmRepository({ dialect: 'sqlite', db: drizzle({ client: raw }) });
    const p = await repo.createProject({ name: 'P', ownerId: 'u', departmentId: 'd' });
    expect(p.id).toBeTruthy();
    raw.close();
  });

  it('unknown dialect → throw', async () => {
    await expect(
      createPmRepository({ dialect: 'unknown' as never, db: {} as never }),
    ).rejects.toThrow('지원하지 않는 dialect');
  });
});
