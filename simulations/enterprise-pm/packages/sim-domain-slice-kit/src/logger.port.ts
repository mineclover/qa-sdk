// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

/**
 * 슬라이스 로그 레코드의 표준 컨텍스트 필드.
 *
 * 한 슬라이스의 모든 use-case 로그가 이 필드들을 공유해야 분석/관측 도구가
 * traceId/correlationId/aggregate 단위로 결합 분석할 수 있다.
 */
export interface SliceLogContext {
  /** 분산 추적 식별자 (request 단위) */
  traceId?: string;
  /** 비즈니스 흐름 상관 식별자 (saga / multi-step) */
  correlationId?: string;
  /** 도메인 이름 (예: "assignment") */
  domain: string;
  /** use-case 이름 (예: "create-assignment") */
  useCase: string;
  /** aggregate root 식별자 */
  aggregateId?: string;
  /** 명령(command) 이름 */
  commandName?: string;
  /** 조회(query) 이름 */
  queryName?: string;
  /** 도메인 이벤트 이름 */
  eventName?: string;
  /** 도메인 이벤트 스키마 버전 */
  eventVersion?: number;
  /** 처리 결과 */
  outcome?: "success" | "failure";
  /** 도메인 에러 코드 (실패 시) */
  errorCode?: string;
  /** 캐시 키 prefix (캐시 히트율 분석용) */
  cacheKeyPrefix?: string;
  /** 캐시 히트 여부 */
  cacheHit?: boolean;
}

/**
 * 슬라이스 로깅 추상.
 *
 * - info/warn 은 SliceLogContext 만
 * - error 는 추가로 err 키 (CLAUDE.md 컨벤션) 를 받는다
 */
export interface LoggerPort {
  info(ctx: SliceLogContext, message: string): void;
  warn(ctx: SliceLogContext, message: string): void;
  error(ctx: SliceLogContext & { err: unknown }, message: string): void;
}
