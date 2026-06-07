// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Resilience Ports — 시스템의 오류 복원력을 위한 표준 인터페이스.
 * 
 * 모든 외부 서비스 호출(Bridge Layer) 및 시스템 핵심 로직(System Layer)은
 * 본 인터페이스를 통해 재시도, 서킷 브레이커, 폴백 전략을 공통으로 관리한다.
 */

export interface ResiliencePolicy {
  readonly id: string;
  readonly kind: "retry" | "circuit-breaker" | "fallback" | "timeout";
}

/** 재시도 정책 */
export interface RetryPolicy extends ResiliencePolicy {
  readonly kind: "retry";
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly factor: number;
  readonly jitter: boolean;
}

/** 서킷 브레이커 정책 */
export interface CircuitBreakerPolicy extends ResiliencePolicy {
  readonly kind: "circuit-breaker";
  readonly threshold: number; // 실패율 (0.0 ~ 1.0)
  readonly windowMs: number;  // 관측 윈도우
  readonly resetMs: number;   // 복구 시도 대기 시간
}

/** 폴백 정책 */
export interface FallbackPolicy<T> extends ResiliencePolicy {
  readonly kind: "fallback";
  readonly fallbackValue: T | ((error: Error) => T | Promise<T>);
}

/** 타임아웃 정책 */
export interface TimeoutPolicy extends ResiliencePolicy {
  readonly kind: "timeout";
  readonly timeoutMs: number;
}

/** 
 * ResilientRunner — 정책을 실행하는 인터페이스.
 * 런타임 패키지(engine, sdk)에서 구현체를 제공한다.
 */
export interface ResilientRunner {
  run<T>(fn: () => Promise<T>, policies: ResiliencePolicy[]): Promise<T>;
}
