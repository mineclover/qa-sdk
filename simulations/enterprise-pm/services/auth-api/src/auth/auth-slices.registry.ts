// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture
//
// Phase 0 산출물 — auth-api 슬라이스 registry.
//
// 소유권 규칙:
// - Phase 2 의 각 에이전트는 자기 슬라이스의 import 라인과 배열 entry 만 주석 해제한다.
// - 다른 라인 / 다른 슬라이스 영역은 절대 수정하지 않는다 (no-overlap 보장).
//
// 비고:
// - authenticate 는 command-only 슬라이스 (entity 없음)
// - bitmap 은 캐시/조회 슬라이스

import { UserSliceModule } from './user/user.module.js'; // Phase 2
import { RoleSliceModule } from './role/role.module.js'; // Phase 2
import { RoleAssignmentSliceModule } from './role-assignment/role-assignment.module.js'; // Phase 2
import { DepartmentSliceModule } from './department/department.module.js'; // Phase 2
import { AuthenticateSliceModule } from './authenticate/authenticate.module.js'; // Phase 2
import { BitmapSliceModule } from './bitmap/bitmap.module.js'; // Phase 2

/**
 * auth 도메인의 슬라이스 모듈 목록. Phase 2 에이전트가 자기 슬라이스의
 * 배열 entry 만 주석 해제한다.
 */
export const AUTH_SLICE_MODULES = [
  UserSliceModule,
  RoleSliceModule,
  RoleAssignmentSliceModule,
  DepartmentSliceModule,
  AuthenticateSliceModule,
  BitmapSliceModule,
] as const;
