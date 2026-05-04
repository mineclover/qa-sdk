// @def.boundary motion-content-system
/**
 * motion-content 도메인 액션 정의.
 *
 * 로컬 이벤트 로그(event-log.ts)에서 사용하는 액션 목록.
 * 전역 좌표계 축/prefix 매핑은 하지 않는다 — 에디터 세션 내 로컬 기록 전용.
 */

/** transport 액션 */
export const MC_TRANSPORT_ACTIONS = [
  "play", "pause", "seek", "restart", "complete", "set_loop", "set_rate",
] as const;

/** 편집 액션 */
export const MC_EDIT_ACTIONS = [
  "select", "edit_timing", "edit_parameter", "undo", "redo",
] as const;

/** 타임라인 액션 */
export const MC_TIMELINE_ACTIONS = [
  "drag_start", "drag_commit",
] as const;

/** 컴포지션 라이프사이클 액션 */
export const MC_COMPOSITION_ACTIONS = [
  "import", "export", "preset_switch",
] as const;

/** 전체 액션 목록 */
export const MC_ALL_ACTIONS = [
  ...MC_TRANSPORT_ACTIONS,
  ...MC_EDIT_ACTIONS,
  ...MC_TIMELINE_ACTIONS,
  ...MC_COMPOSITION_ACTIONS,
] as const;
