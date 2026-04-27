// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

export interface ProjectDetailReadModel {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly departmentId: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectDelegationReadModel {
  readonly graphId: string;
  readonly snapshotId: string;
  readonly nodeCount: number;
  readonly relationCount: number;
  readonly graph: {
    readonly nodes: Array<{ nodeId: string; coord: { anchor: string } }>;
    readonly relations: Array<{ relationId: string }>;
  };
}

export abstract class ProjectReadModelQuery {
  abstract findDetail(id: string): Promise<ProjectDetailReadModel | null>;
  abstract listByDepartment(departmentId: string): Promise<ProjectDetailReadModel[]>;
  abstract listByOwner(ownerId: string): Promise<ProjectDetailReadModel[]>;
  abstract findDelegationSnapshot(id: string): Promise<ProjectDelegationReadModel | null>;
}
