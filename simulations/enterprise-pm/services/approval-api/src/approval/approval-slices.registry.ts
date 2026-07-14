// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture
//
// Phase 0 산출물 — approval-api 슬라이스 registry.
//
// 소유권 규칙:
// - Phase 2 의 각 에이전트는 자기 슬라이스의 import 라인과 배열 entry 만 주석 해제한다.
// - 다른 라인 / 다른 슬라이스 영역은 절대 수정하지 않는다 (no-overlap 보장).

import { BudgetSliceModule } from './budget/budget.module.js'; // Phase 2
import { ExpenseSliceModule } from './expense/expense.module.js'; // Phase 2
import { ResourceSliceModule } from './resource/resource.module.js'; // Phase 2
import { TimeoffSliceModule } from './timeoff/timeoff.module.js'; // Phase 2

/**
 * approval 도메인의 슬라이스 모듈 목록. Phase 2 에이전트가 자기 슬라이스의
 * 배열 entry 만 주석 해제한다.
 */
export const APPROVAL_SLICE_MODULES = [
  BudgetSliceModule,
  ExpenseSliceModule,
  ResourceSliceModule,
  TimeoffSliceModule,
] as const;
