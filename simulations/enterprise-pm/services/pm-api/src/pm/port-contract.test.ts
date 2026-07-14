// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { createPmRepository, type PmRepoDialect } from './factory.js';
import { SIM_PM_SQLITE_DDL } from './sqlite/schema.js';
import { SIM_PM_PG_RESET_DDL } from './pg/schema.js';
import type { PmRepository } from './shared/port.js';

interface FixtureRunner {
  setup(): Promise<{ repo: PmRepository; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const raw = new Database(':memory:');
    raw.exec(SIM_PM_SQLITE_DDL);
    const repo = await createPmRepository({
      dialect: 'sqlite',
      db: drizzleSqlite({ client: raw }),
    });
    return {
      repo,
      cleanup: async () => {
        raw.close();
      },
    };
  },
};

function makePgRunner(): FixtureRunner {
  const PG_CFG = {
    host: process.env.QA_TEST_PG_HOST ?? 'localhost',
    port: Number(process.env.QA_TEST_PG_PORT ?? '5434'),
    database: process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test',
    user: process.env.QA_TEST_PG_USER ?? 'qa_admin',
    password: process.env.QA_TEST_PG_PASSWORD ?? '',
  };
  return {
    async setup() {
      const sql = postgres({
        host: PG_CFG.host,
        port: PG_CFG.port,
        database: PG_CFG.database,
        user: PG_CFG.user,
        password: PG_CFG.password,
        max: 5,
        onnotice: () => {},
      });
      await sql.unsafe(SIM_PM_PG_RESET_DDL);
      const repo = await createPmRepository({ dialect: 'pg', db: drizzlePg({ client: sql }) });
      return {
        repo,
        cleanup: async () => {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS sim.pm_project_members CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.pm_tasks CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.pm_projects CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';
const matrix: Array<[PmRepoDialect, FixtureRunner]> = [
  ['sqlite', sqliteRunner],
  ...(PG_AVAILABLE ? ([['pg', makePgRunner()]] as Array<[PmRepoDialect, FixtureRunner]>) : []),
];

describe.each(matrix)('PmRepository contract — %s', (dialect, runner) => {
  let repo: PmRepository;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await runner.setup();
    repo = ctx.repo;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it(`createProject + findProject — ${dialect}`, async () => {
    const p = await repo.createProject({
      name: `c-${dialect}`,
      ownerId: 'u-1',
      departmentId: 'd-1',
    });
    expect((await repo.findProject(p.id))?.ownerId).toBe('u-1');
  });

  it(`addMember + listProjectsForUser — ${dialect}`, async () => {
    const p = await repo.createProject({
      name: `m-${dialect}`,
      ownerId: 'u-1',
      departmentId: 'd-1',
    });
    await repo.addMember({ projectId: p.id, userId: 'u-2', role: 'lead' });
    const list = await repo.listProjectsForUser('u-2');
    expect(list.length).toBe(1);
    expect(list[0].projectId).toBe(p.id);
  });

  it(`parent/child task — ${dialect}`, async () => {
    const p = await repo.createProject({
      name: `t-${dialect}`,
      ownerId: 'u-1',
      departmentId: 'd-1',
    });
    const parent = await repo.createTask({ projectId: p.id, title: 'Parent' });
    const child = await repo.createTask({
      projectId: p.id,
      title: 'Child',
      parentTaskId: parent.id,
    });
    const subs = await repo.listSubtasks(parent.id);
    expect(subs.map((s) => s.id)).toEqual([child.id]);
  });

  it(`updateProject status — ${dialect}`, async () => {
    const p = await repo.createProject({
      name: `s-${dialect}`,
      ownerId: 'u-1',
      departmentId: 'd-1',
      status: 'draft',
    });
    const next = await repo.updateProject(p.id, { status: 'active' });
    expect(next.status).toBe('active');
  });
});
