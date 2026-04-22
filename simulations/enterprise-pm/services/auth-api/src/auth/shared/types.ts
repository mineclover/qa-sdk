// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

export type ScopeType = "global" | "department" | "project";

export interface User {
  id: string;
  email: string;
  displayName: string;
  departmentId: string | null;
  primaryRoleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  scopeType: ScopeType;
  /** role의 기본 ACTION 비트마스크 (hex). computeUserBits에서 base mask로 사용. */
  defaultMaskHex: string;
  createdAt: string;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  /** scopeType=global이면 null. department/project이면 해당 ID. */
  scopeId: string | null;
  assignedAt: string;
}

export interface UserCreate {
  email: string;
  displayName: string;
  departmentId?: string;
  primaryRoleId?: string;
}

export interface DepartmentCreate {
  name: string;
  parentId?: string;
  managerId?: string;
}

export interface RoleCreate {
  name: string;
  scopeType: ScopeType;
  defaultMaskHex: string;
}

export interface RoleAssignmentCreate {
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  scopeId: string | null;
}
