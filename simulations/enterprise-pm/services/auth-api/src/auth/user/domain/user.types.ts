// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { UserId, DepartmentId, RoleId } from './user.ids.js';

/**
 * User 라이프사이클 상태. Phase 2 에서 active 만 사용 (legacy users 테이블이
 * status 컬럼을 가지지 않음). soft-delete 도입은 별도 마이그레이션 필요.
 */
export type UserStatus = 'active';

/** 도메인 entity 의 내부 props (branded ids, 불변). */
export interface UserProps {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly departmentId: DepartmentId | null;
  readonly primaryRoleId: RoleId | null;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 영속/와이어 직렬화 형 — branding 제거, ISO 문자열. */
export interface UserSnapshot {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly departmentId: string | null;
  readonly primaryRoleId: string | null;
  readonly status: UserStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
