// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { DepartmentId, ManagerId } from "./department.ids.js";

export interface DepartmentProps {
  readonly id: DepartmentId;
  readonly name: string;
  readonly parentId: DepartmentId | null;
  readonly managerId: ManagerId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DepartmentSnapshot {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly managerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
