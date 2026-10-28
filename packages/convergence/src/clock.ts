// @def.boundary convergence-layer-group
/**
 * 분석 시각 공급자 — 결정론 테스트와 G3 재계산에서 주입한다.
 *
 * 규칙: 한 진입점 안에서는 clock을 한 번만 평가하고 그 값을 하위 호출에 넘긴다.
 * (자정 경계에서 같은 실행의 단계들이 서로 다른 날짜를 갖지 않게 한다)
 *
 * @layer 기록 (Recording)
 */

/** 현재 시각을 반환하는 함수 */
export type Clock = () => Date;

/** 기본 clock — 시스템 시각 */
export const systemClock: Clock = () => new Date();

/** clock 시각의 ISO-8601 instant (`toISOString()`) */
export function isoInstant(clock: Clock): string {
  return clock().toISOString();
}

/** clock 시각의 UTC 날짜 (`YYYY-MM-DD`) */
export function isoDate(clock: Clock): string {
  return isoInstant(clock).slice(0, 10);
}

/** clock 주입 옵션 — 분석 함수 공통 */
export interface ClockOptions {
  /** 분석 시각 공급자 (기본: systemClock) */
  readonly clock?: Clock;
}
