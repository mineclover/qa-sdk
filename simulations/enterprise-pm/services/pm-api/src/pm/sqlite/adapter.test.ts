import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SqlitePmRepository } from './adapter.js';
import { SIM_PM_SQLITE_DDL } from './schema.js';

function fixture() {
  const raw = new Database(':memory:');
  raw.exec(SIM_PM_SQLITE_DDL);
  return {
    repo: new SqlitePmRepository(drizzle({ client: raw })),
    close: () => raw.close(),
  };
}

describe('SqlitePmRepository', () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.close());

  it('createProject + findProject round-trip', async () => {
    const p = await f.repo.createProject({
      name: 'P1',
      ownerId: 'u-1',
      departmentId: 'd-1',
      status: 'active',
    });
    expect((await f.repo.findProject(p.id))?.name).toBe('P1');
  });

  it('listProjectsByDepartment + listProjectsByOwner', async () => {
    await f.repo.createProject({ name: 'A', ownerId: 'u-1', departmentId: 'd-1' });
    await f.repo.createProject({ name: 'B', ownerId: 'u-1', departmentId: 'd-2' });
    await f.repo.createProject({ name: 'C', ownerId: 'u-2', departmentId: 'd-1' });
    expect((await f.repo.listProjectsByDepartment('d-1')).length).toBe(2);
    expect((await f.repo.listProjectsByOwner('u-1')).length).toBe(2);
  });

  it('createTask + parent-child + listSubtasks', async () => {
    const p = await f.repo.createProject({ name: 'P', ownerId: 'u', departmentId: 'd' });
    const parent = await f.repo.createTask({ projectId: p.id, title: 'Parent' });
    const child = await f.repo.createTask({
      projectId: p.id,
      title: 'Child',
      parentTaskId: parent.id,
    });
    const subs = await f.repo.listSubtasks(parent.id);
    expect(subs.length).toBe(1);
    expect(subs[0].id).toBe(child.id);
  });

  it('addMember + listMembers + removeMember', async () => {
    await f.repo.addMember({ projectId: 'p-1', userId: 'u-1', role: 'lead' });
    await f.repo.addMember({ projectId: 'p-1', userId: 'u-2', role: 'contributor' });
    expect((await f.repo.listMembers('p-1')).length).toBe(2);
    await f.repo.removeMember('p-1', 'u-1');
    expect((await f.repo.listMembers('p-1')).length).toBe(1);
  });

  it('listProjectsForUser — user가 속한 project들', async () => {
    await f.repo.addMember({ projectId: 'p-1', userId: 'u-1', role: 'lead' });
    await f.repo.addMember({ projectId: 'p-2', userId: 'u-1', role: 'contributor' });
    expect((await f.repo.listProjectsForUser('u-1')).length).toBe(2);
  });

  it('updateProject status 전이', async () => {
    const p = await f.repo.createProject({
      name: 'P',
      ownerId: 'u',
      departmentId: 'd',
      status: 'draft',
    });
    const updated = await f.repo.updateProject(p.id, { status: 'active' });
    expect(updated.status).toBe('active');
  });

  it('updateTask assignee 변경', async () => {
    const p = await f.repo.createProject({ name: 'P', ownerId: 'u', departmentId: 'd' });
    const t = await f.repo.createTask({ projectId: p.id, title: 'T' });
    const updated = await f.repo.updateTask(t.id, { assigneeId: 'user-new' });
    expect(updated.assigneeId).toBe('user-new');
  });

  it('deleteProject', async () => {
    const p = await f.repo.createProject({ name: 'P', ownerId: 'u', departmentId: 'd' });
    await f.repo.deleteProject(p.id);
    expect(await f.repo.findProject(p.id)).toBeNull();
  });
});
