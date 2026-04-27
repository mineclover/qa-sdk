// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface RoleDetailReadModel {
  readonly id: string;
  readonly name: string;
  readonly scopeType: string;
  readonly defaultMaskHex: string;
  readonly createdAt: string;
}

export abstract class RoleReadModelQuery {
  abstract findDetail(id: string): Promise<RoleDetailReadModel | null>;
  abstract findByName(name: string): Promise<RoleDetailReadModel | null>;
  abstract list(): Promise<RoleDetailReadModel[]>;
}
