// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * Role 슬라이스의 read model 의 일부만 노출 — bitmap 슬라이스는 role 도메인
 * 타입을 직접 import 하지 않고 본 port 로만 의존한다.
 */
export type RoleScopeTypeForBitmap = 'global' | 'department' | 'project';

export interface RoleViewForBitmap {
  readonly id: string;
  readonly name: string;
  readonly scopeType: RoleScopeTypeForBitmap;
  readonly defaultMaskHex: string;
}

export abstract class RoleQueryPort {
  abstract findById(roleId: string): Promise<RoleViewForBitmap | null>;
}
