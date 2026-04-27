// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture
//
// Phase 0 산출물 — notification-api 슬라이스 registry.
//
// 소유권 규칙:
// - Phase 2 의 각 에이전트는 자기 슬라이스의 import 라인과 배열 entry 만 주석 해제한다.
// - 다른 라인 / 다른 슬라이스 영역은 절대 수정하지 않는다 (no-overlap 보장).

import { NotificationSliceModule } from "./notification/notification.module.js"; // Phase 2
import { SubscriptionSliceModule } from "./subscription/subscription.module.js"; // Phase 2

/**
 * notification 도메인의 슬라이스 모듈 목록. Phase 2 에이전트가 자기 슬라이스의
 * 배열 entry 만 주석 해제한다.
 */
export const NOTIFICATION_SLICE_MODULES = [
  NotificationSliceModule,
  SubscriptionSliceModule,
] as const;
