// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { AuthRepository } from "../shared/port.js";
import type {
  User,
  UserCreate,
  Department,
  DepartmentCreate,
  Role,
  RoleCreate,
  RoleAssignment,
  RoleAssignmentCreate,
} from "../shared/types.js";
import {
  UserNotFoundError,
  DuplicateUserError,
  DepartmentNotFoundError,
  RoleNotFoundError,
} from "../shared/errors.js";
import { users, departments, roles, roleAssignments } from "./schema.js";

export class PgAuthRepository implements AuthRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  // ── User ────────────────────────────────────────────────
  async createUser(args: UserCreate): Promise<User> {
    const existing = await this.findUserByEmail(args.email);
    if (existing) throw new DuplicateUserError(args.email);
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      email: args.email,
      displayName: args.displayName,
      departmentId: args.departmentId ?? null,
      primaryRoleId: args.primaryRoleId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(users).values({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      departmentId: user.departmentId,
      primaryRoleId: user.primaryRoleId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    return user;
  }

  async findUser(userId: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async listUsersByDepartment(departmentId: string): Promise<User[]> {
    const rows = await this.db.select().from(users).where(eq(users.departmentId, departmentId));
    return rows.map(toUser);
  }

  async updateUser(userId: string, patch: Partial<UserCreate>): Promise<User> {
    const cur = await this.findUser(userId);
    if (!cur) throw new UserNotFoundError(userId);
    const now = new Date().toISOString();
    const next: User = {
      ...cur,
      email: patch.email ?? cur.email,
      displayName: patch.displayName ?? cur.displayName,
      departmentId: patch.departmentId ?? cur.departmentId,
      primaryRoleId: patch.primaryRoleId ?? cur.primaryRoleId,
      updatedAt: now,
    };
    await this.db.update(users).set({
      email: next.email,
      displayName: next.displayName,
      departmentId: next.departmentId,
      primaryRoleId: next.primaryRoleId,
      updatedAt: next.updatedAt,
    }).where(eq(users.id, userId));
    return next;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }

  // ── Department ──────────────────────────────────────────
  async createDepartment(args: DepartmentCreate): Promise<Department> {
    const now = new Date().toISOString();
    const dept: Department = {
      id: randomUUID(),
      name: args.name,
      parentId: args.parentId ?? null,
      managerId: args.managerId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(departments).values({
      id: dept.id,
      name: dept.name,
      parentId: dept.parentId,
      managerId: dept.managerId,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
    });
    return dept;
  }

  async findDepartment(deptId: string): Promise<Department | null> {
    const rows = await this.db.select().from(departments).where(eq(departments.id, deptId)).limit(1);
    return rows[0] ? toDepartment(rows[0]) : null;
  }

  async listDepartments(): Promise<Department[]> {
    const rows = await this.db.select().from(departments);
    return rows.map(toDepartment);
  }

  async resolveDepartmentChain(deptId: string): Promise<Department[]> {
    const chain: Department[] = [];
    let curId: string | null = deptId;
    const seen = new Set<string>();
    while (curId && !seen.has(curId)) {
      seen.add(curId);
      const dept = await this.findDepartment(curId);
      if (!dept) break;
      chain.push(dept);
      curId = dept.parentId;
    }
    return chain;
  }

  async updateDepartment(deptId: string, patch: Partial<DepartmentCreate>): Promise<Department> {
    const cur = await this.findDepartment(deptId);
    if (!cur) throw new DepartmentNotFoundError(deptId);
    const now = new Date().toISOString();
    const next: Department = {
      ...cur,
      name: patch.name ?? cur.name,
      parentId: patch.parentId ?? cur.parentId,
      managerId: patch.managerId ?? cur.managerId,
      updatedAt: now,
    };
    await this.db.update(departments).set({
      name: next.name,
      parentId: next.parentId,
      managerId: next.managerId,
      updatedAt: next.updatedAt,
    }).where(eq(departments.id, deptId));
    return next;
  }

  async deleteDepartment(deptId: string): Promise<void> {
    await this.db.delete(departments).where(eq(departments.id, deptId));
  }

  // ── Role ────────────────────────────────────────────────
  async createRole(args: RoleCreate): Promise<Role> {
    const role: Role = {
      id: randomUUID(),
      name: args.name,
      scopeType: args.scopeType,
      defaultMaskHex: args.defaultMaskHex,
      createdAt: new Date().toISOString(),
    };
    await this.db.insert(roles).values(role);
    return role;
  }

  async findRole(roleId: string): Promise<Role | null> {
    const rows = await this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    return rows[0] ? (rows[0] as Role) : null;
  }

  async listRoles(): Promise<Role[]> {
    return (await this.db.select().from(roles)) as Role[];
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, roleId));
  }

  // ── RoleAssignment ──────────────────────────────────────
  async assignRole(args: RoleAssignmentCreate): Promise<RoleAssignment> {
    const role = await this.findRole(args.roleId);
    if (!role) throw new RoleNotFoundError(args.roleId);
    const now = new Date().toISOString();
    await this.db.insert(roleAssignments).values({
      userId: args.userId,
      roleId: args.roleId,
      scopeType: args.scopeType,
      scopeId: encodeScopeId(args.scopeId),
      assignedAt: now,
    }).onConflictDoNothing();
    return {
      userId: args.userId,
      roleId: args.roleId,
      scopeType: args.scopeType,
      scopeId: args.scopeId,
      assignedAt: now,
    };
  }

  async revokeRole(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<void> {
    await this.db.delete(roleAssignments).where(
      and(
        eq(roleAssignments.userId, userId),
        eq(roleAssignments.roleId, roleId),
        eq(roleAssignments.scopeType, scopeType as "global" | "department" | "project"),
        eq(roleAssignments.scopeId, encodeScopeId(scopeId)),
      ),
    );
  }

  async listAssignmentsForUser(userId: string): Promise<RoleAssignment[]> {
    const rows = await this.db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId));
    return rows.map(toRoleAssignment);
  }
}

/** scope_id null → '' sentinel (PG PRIMARY KEY NOT NULL 대응). */
function encodeScopeId(scopeId: string | null): string {
  return scopeId ?? "";
}

/** scope_id '' sentinel → null (port interface 일관성). */
function decodeScopeId(scopeId: string): string | null {
  return scopeId === "" ? null : scopeId;
}

function toRoleAssignment(row: typeof roleAssignments.$inferSelect): RoleAssignment {
  return {
    userId: row.userId,
    roleId: row.roleId,
    scopeType: row.scopeType,
    scopeId: decodeScopeId(row.scopeId),
    assignedAt: row.assignedAt,
  };
}

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    departmentId: row.departmentId ?? null,
    primaryRoleId: row.primaryRoleId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDepartment(row: typeof departments.$inferSelect): Department {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId ?? null,
    managerId: row.managerId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
