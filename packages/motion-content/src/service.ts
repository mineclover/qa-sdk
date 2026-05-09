// @def.boundary motion-content-system
/**
 * motion-content 서비스 부트 설정.
 *
 * ownedPrefixes는 사용하지 않는다 — 로컬 이벤트 로그 전용.
 */

/** 서비스 메타데이터 */
export interface MotionServiceMeta {
  readonly serviceId: string;
  readonly name: string;
  readonly description: string;
}

/** motion-content 서비스 */
export const MOTION_CONTENT_SERVICE: MotionServiceMeta = {
  serviceId: "motion-content",
  name: "모션 콘텐츠",
  description: "GSAP 기반 선언형 모션 콘텐츠 코어. 로컬 세션 이벤트 로그로 행동 기록",
};
