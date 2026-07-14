// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── Actor Context ────────────────────────────────────────

import type { IdentificationMode } from './event-pattern.js';

export type { IdentificationMode };

/**
 * 이벤트를 발생시킨 행위 주체 컨텍스트.
 *
 * - actor_id: 행위 주체 식별자. 실제 사람, 봇, AI 에이전트 모두 포함. 필수.
 *   PII를 피하려면 pseudonymized token을 사용한다.
 * - user_id: 실제 서비스 유저 식별자. PII 포함 가능. 테넌트가 제공 여부를 결정한다.
 * - user_attributes: 익명화된 분류 속성. PII 없이 집계/분석에 사용한다.
 *   e.g. { age_group: "30s", gender: "f", tier: "premium", platform: "mobile" }
 */
export interface ActorContext {
  /** 행위 주체 식별자 (필수) */
  actor_id: string;
  /** 실제 서비스 유저 식별자 (선택, PII 포함 가능) */
  user_id?: string;
  /** 식별 모드 — anonymous/identified/pseudonymized/service. 미지정 시 자동 판별 */
  identification_mode?: IdentificationMode;
  /** 익명화된 분류 속성 (선택) */
  user_attributes?: Record<string, string>;
}
