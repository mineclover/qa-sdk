// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { createLogger as base } from "@qa-sdk/core";
import type { Logger } from "@qa-sdk/core";

/**
 * sim-canary-controller 전용 logger.
 *
 * 모든 도메인 모듈은 createLogger("sim-canary-controller:<sub>")로 sub-namespace 사용.
 *
 * SIM_LOG_LEVEL은 pino 환경 자체의 NODE_ENV 기반 기본값을 따른다 — env 모듈이 zod로
 * 검증할 뿐 createLogger 옵션은 destinations 단일 진입점만 받는다.
 */
export function createLogger(name: string): Logger {
  return base(name);
}

export type { Logger } from "@qa-sdk/core";
