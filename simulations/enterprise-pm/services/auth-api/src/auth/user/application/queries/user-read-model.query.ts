// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/** Read-side detail DTO — command 측 entity 와 독립. */
export interface UserDetailReadModel {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly departmentId: string | null;
  readonly primaryRoleId: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Read 전용 추상 (CQRS — Primary DB 직접 read 금지, Read Model 우선). */
export abstract class UserReadModelQuery {
  abstract findDetail(id: string): Promise<UserDetailReadModel | null>;
  abstract findByEmail(email: string): Promise<UserDetailReadModel | null>;
  abstract listByDepartment(departmentId: string): Promise<UserDetailReadModel[]>;
}
