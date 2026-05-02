// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { PmRepository } from "../shared/port.js";
import type {
  Project,
  ProjectCreate,
  Task,
  TaskCreate,
  ProjectMember,
  MemberCreate,
} from "../shared/types.js";
import { ProjectNotFoundError, TaskNotFoundError } from "../shared/errors.js";
import { projects, tasks, projectMembers } from "./schema.js";

export class PgPmRepository implements PmRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  // ── Project ────
  async createProject(args: ProjectCreate): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: args.name,
      ownerId: args.ownerId,
      departmentId: args.departmentId,
      status: args.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(projects).values(project);
    return project;
  }

  async findProject(id: string): Promise<Project | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return rows[0] ? (rows[0] as Project) : null;
  }

  async listProjectsByDepartment(departmentId: string): Promise<Project[]> {
    return (await this.db.select().from(projects).where(eq(projects.departmentId, departmentId))) as Project[];
  }

  async listProjectsByOwner(ownerId: string): Promise<Project[]> {
    return (await this.db.select().from(projects).where(eq(projects.ownerId, ownerId))) as Project[];
  }

  async updateProject(id: string, patch: Partial<ProjectCreate>): Promise<Project> {
    const cur = await this.findProject(id);
    if (!cur) throw new ProjectNotFoundError(id);
    const now = new Date().toISOString();
    const next: Project = {
      ...cur,
      name: patch.name ?? cur.name,
      ownerId: patch.ownerId ?? cur.ownerId,
      departmentId: patch.departmentId ?? cur.departmentId,
      status: patch.status ?? cur.status,
      updatedAt: now,
    };
    await this.db.update(projects).set({
      name: next.name,
      ownerId: next.ownerId,
      departmentId: next.departmentId,
      status: next.status,
      updatedAt: next.updatedAt,
    }).where(eq(projects.id, id));
    return next;
  }

  async deleteProject(id: string): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, id));
  }

  // ── Task ────
  async createTask(args: TaskCreate): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      projectId: args.projectId,
      title: args.title,
      assigneeId: args.assigneeId ?? null,
      status: args.status ?? "todo",
      parentTaskId: args.parentTaskId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(tasks).values({
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      assigneeId: task.assigneeId,
      status: task.status,
      parentTaskId: task.parentTaskId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
    return task;
  }

  async findTask(id: string): Promise<Task | null> {
    const rows = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return rows[0] ? toTask(rows[0]) : null;
  }

  async listTasksByProject(projectId: string): Promise<Task[]> {
    const rows = await this.db.select().from(tasks).where(eq(tasks.projectId, projectId));
    return rows.map(toTask);
  }

  async listSubtasks(parentTaskId: string): Promise<Task[]> {
    const rows = await this.db.select().from(tasks).where(eq(tasks.parentTaskId, parentTaskId));
    return rows.map(toTask);
  }

  async updateTask(id: string, patch: Partial<TaskCreate>): Promise<Task> {
    const cur = await this.findTask(id);
    if (!cur) throw new TaskNotFoundError(id);
    const now = new Date().toISOString();
    const next: Task = {
      ...cur,
      projectId: patch.projectId ?? cur.projectId,
      title: patch.title ?? cur.title,
      assigneeId: patch.assigneeId ?? cur.assigneeId,
      status: patch.status ?? cur.status,
      parentTaskId: patch.parentTaskId ?? cur.parentTaskId,
      updatedAt: now,
    };
    await this.db.update(tasks).set({
      projectId: next.projectId,
      title: next.title,
      assigneeId: next.assigneeId,
      status: next.status,
      parentTaskId: next.parentTaskId,
      updatedAt: next.updatedAt,
    }).where(eq(tasks.id, id));
    return next;
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.id, id));
  }

  // ── Member ────
  async addMember(args: MemberCreate): Promise<ProjectMember> {
    const now = new Date().toISOString();
    const m: ProjectMember = {
      projectId: args.projectId,
      userId: args.userId,
      role: args.role,
      joinedAt: now,
    };
    await this.db.insert(projectMembers).values(m).onConflictDoNothing();
    return m;
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.db.delete(projectMembers).where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    );
  }

  async listMembers(projectId: string): Promise<ProjectMember[]> {
    return (await this.db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId))) as ProjectMember[];
  }

  async listProjectsForUser(userId: string): Promise<ProjectMember[]> {
    return (await this.db.select().from(projectMembers).where(eq(projectMembers.userId, userId))) as ProjectMember[];
  }
}

function toTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    assigneeId: row.assigneeId ?? null,
    status: row.status,
    parentTaskId: row.parentTaskId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
