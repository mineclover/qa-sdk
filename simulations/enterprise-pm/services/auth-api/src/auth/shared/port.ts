// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type {
  User,
  UserCreate,
  Department,
  DepartmentCreate,
  Role,
  RoleCreate,
  RoleAssignment,
  RoleAssignmentCreate,
} from "./types.js";

/**
 * AuthRepository — auth domain의 모든 영속 작업을 추상화.
 * SQLite/PG 어댑터가 본 인터페이스를 구현. NestJS service layer는 port만 의존.
 */
export interface AuthRepository {
  // ── User ────
  createUser(args: UserCreate): Promise<User>;
  findUser(userId: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  listUsersByDepartment(departmentId: string): Promise<User[]>;
  updateUser(userId: string, patch: Partial<UserCreate>): Promise<User>;
  deleteUser(userId: string): Promise<void>;

  // ── Department ────
  createDepartment(args: DepartmentCreate): Promise<Department>;
  findDepartment(deptId: string): Promise<Department | null>;
  listDepartments(): Promise<Department[]>;
  /** parent chain — root까지의 ancestor 목록 (자기 자신 포함). */
  resolveDepartmentChain(deptId: string): Promise<Department[]>;
  updateDepartment(deptId: string, patch: Partial<DepartmentCreate>): Promise<Department>;
  deleteDepartment(deptId: string): Promise<void>;

  // ── Role ────
  createRole(args: RoleCreate): Promise<Role>;
  findRole(roleId: string): Promise<Role | null>;
  listRoles(): Promise<Role[]>;
  deleteRole(roleId: string): Promise<void>;

  // ── RoleAssignment ────
  assignRole(args: RoleAssignmentCreate): Promise<RoleAssignment>;
  revokeRole(userId: string, roleId: string, scopeType: string, scopeId: string | null): Promise<void>;
  listAssignmentsForUser(userId: string): Promise<RoleAssignment[]>;
}
