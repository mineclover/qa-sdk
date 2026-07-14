// @def.boundary sim-approval-api
// @def.doc authorization-ontology-bitmap-pipeline

import type { Logger } from '@qa-sdk/core';
import type { SubscriberLogger } from '@qa-sdk/sim-bitmap-cache';

/**
 * pino-style Logger → SubscriberLogger 인터페이스 어댑터.
 * sim-bitmap-cache는 최소 인터페이스만 의존, 서비스별 logger 주입 가능.
 */
export function createSubscriberLogger(logger: Logger): SubscriberLogger {
  return {
    info: (obj, msg) => logger.info(obj as Record<string, unknown>, msg),
    warn: (obj, msg) => logger.warn(obj as Record<string, unknown>, msg),
    error: (obj, msg) => logger.error(obj as Record<string, unknown>, msg),
  };
}
