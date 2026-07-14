// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { RoleId } from './role.ids.js';

/** Scope 종류. */
export type RoleScopeType = 'global' | 'department' | 'project';

/** 도메인 entity 의 내부 props. */
export interface RoleProps {
  readonly id: RoleId;
  readonly name: string;
  readonly scopeType: RoleScopeType;
  readonly defaultMaskHex: string;
  readonly createdAt: Date;
}

/** 영속/와이어 직렬화 형. */
export interface RoleSnapshot {
  readonly id: string;
  readonly name: string;
  readonly scopeType: RoleScopeType;
  readonly defaultMaskHex: string;
  readonly createdAt: string;
}
