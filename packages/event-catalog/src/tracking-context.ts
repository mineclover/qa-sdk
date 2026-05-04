// @def.boundary event-vocab-system
/**
 * TrackingContextManager — 런타임 컨텍스트 자동 관리.
 *
 * 페이지 이동, 로그인/로그아웃, 로케일 변경 등을
 * 개별 이벤트마다 넘기지 않고 한 곳에서 관리한다.
 *
 * 사용법:
 *   const ctx = createTrackingContext({ locale: 'ko' });
 *   ctx.setPage('home');
 *   ctx.setUser('member');
 *   qa.track('cart.add', { item_id: 7 });  // page, userType, locale 자동 포함
 */

import type { TrackingContext } from "./prefix-mapping.js";

export interface TrackingContextConfig {
  /** 기본 로케일 */
  locale?: string;
  /** 초기 userType (기본: "guest") */
  initialUserType?: string;
  /** 초기 페이지 */
  initialPage?: string;
  /** 커스텀 기본값 */
  defaults?: Record<string, string>;
}

export interface TrackingContextManager {
  /** 현재 컨텍스트 스냅샷 반환 */
  get(): TrackingContext;
  /** 현재 페이지 설정 (네비게이션 시 호출) */
  setPage(page: string): void;
  /** 사용자 타입 설정 (로그인/로그아웃 시 호출) */
  setUser(userType: string): void;
  /** 로케일 변경 */
  setLocale(locale: string): void;
  /** 커스텀 값 설정 */
  set(key: string, value: string): void;
  /** 커스텀 값 제거 */
  unset(key: string): void;
  /** 로그아웃 — userType을 guest로 리셋 + 커스텀 값 초기화 */
  reset(): void;
}

export function createTrackingContext(config: TrackingContextConfig = {}): TrackingContextManager {
  let page = config.initialPage ?? "";
  let userType = config.initialUserType ?? "guest";
  let locale = config.locale ?? "ko";
  const custom = new Map<string, string>(Object.entries(config.defaults ?? {}));

  return {
    get(): TrackingContext {
      const ctx: TrackingContext = { page, userType, locale };
      for (const [k, v] of custom) ctx[k] = v;
      return ctx;
    },
    setPage(p: string) { page = p; },
    setUser(u: string) { userType = u; },
    setLocale(l: string) { locale = l; },
    set(key: string, value: string) { custom.set(key, value); },
    unset(key: string) { custom.delete(key); },
    reset() {
      userType = config.initialUserType ?? "guest";
      page = "";
      custom.clear();
      if (config.defaults) {
        for (const [k, v] of Object.entries(config.defaults)) custom.set(k, v);
      }
    },
  };
}
