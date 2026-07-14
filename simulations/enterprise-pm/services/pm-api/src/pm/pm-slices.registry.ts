// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture
//
// Phase 0 산출물 — pm-api 슬라이스 registry.
//
// 소유권 규칙:
// - Phase 2 의 각 에이전트는 자기 슬라이스의 import 라인과 배열 entry 만 주석 해제한다.
// - 다른 라인 / 다른 슬라이스 영역은 절대 수정하지 않는다 (no-overlap 보장).
// - Phase 1 에서 assignment 만 활성화된다. 나머지는 Phase 2 에서 활성화된다.

import { AssignmentSliceModule } from './assignment/assignment.module.js'; // Phase 1
import { ProjectSliceModule } from './project/project.module.js'; // Phase 2
import { TaskSliceModule } from './task/task.module.js'; // Phase 2
import { MemberSliceModule } from './member/member.module.js'; // Phase 2

/**
 * pm 도메인의 슬라이스 모듈 목록. 각 Phase 2 에이전트가 자기 슬라이스의
 * 배열 entry 만 주석 해제한다.
 */
export const PM_SLICE_MODULES = [
  AssignmentSliceModule, // Phase 1
  ProjectSliceModule, // Phase 2
  TaskSliceModule, // Phase 2
  MemberSliceModule, // Phase 2
] as const;
