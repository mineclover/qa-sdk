/** 값을 [minimum, maximum] 범위로 제한한다 */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** 재생 속도를 양수로 정규화한다 (유효하지 않으면 1) */
export function normalizePlaybackRate(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

/** ms 단위 최소 타임라인 윈도우 */
export const MIN_TIMELINE_WINDOW_MS = 120;

/** MotionTimeSpan의 종료 시점을 계산한다 */
export function endMs(span: { readonly startMs: number; readonly durationMs: number }): number {
  return span.startMs + span.durationMs;
}
