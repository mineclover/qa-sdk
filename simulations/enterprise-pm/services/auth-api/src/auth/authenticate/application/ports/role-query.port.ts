// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface RoleViewForAuthenticate {
  readonly id: string;
  readonly name: string;
}

/** Cross-domain — role 슬라이스 read model 의 일부만 노출. */
export abstract class RoleQueryPort {
  abstract findById(roleId: string): Promise<RoleViewForAuthenticate | null>;
}
