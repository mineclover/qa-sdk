// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface DepartmentDetailReadModel {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly managerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export abstract class DepartmentReadModelQuery {
  abstract findDetail(id: string): Promise<DepartmentDetailReadModel | null>;
  abstract list(): Promise<DepartmentDetailReadModel[]>;
  abstract resolveChain(id: string): Promise<DepartmentDetailReadModel[]>;
}
