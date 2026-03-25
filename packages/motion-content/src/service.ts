/**
 * motion-content-editor 서비스 부트 설정.
 *
 * ownedPrefixes는 사용하지 않는다 — 로컬 이벤트 로그 전용.
 */

/** 서비스 메타데이터 */
export interface MotionServiceMeta {
  readonly serviceId: string;
  readonly name: string;
  readonly description: string;
}

/** motion-content-editor 서비스 */
export const MOTION_EDITOR_SERVICE: MotionServiceMeta = {
  serviceId: "motion-content-editor",
  name: "모션 콘텐츠 편집기",
  description: "GSAP 기반 선언형 모션 콘텐츠 편집기. 로컬 세션 이벤트 로그로 행동 기록",
};

/** demo 앱 서비스 */
export const MOTION_DEMO_SERVICE: MotionServiceMeta = {
  serviceId: "motion-content-editor-demo",
  name: "모션 편집기 데모",
  description: "motion-content-editor의 브라우저 검증 앱",
};
