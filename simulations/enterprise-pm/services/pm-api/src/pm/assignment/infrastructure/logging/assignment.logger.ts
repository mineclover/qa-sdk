// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from '@qa-sdk/sim-domain-slice-kit';
import { createLogger } from '../../../../lib/logger.js';

/**
 * Assignment 슬라이스 LoggerPort 어댑터.
 *
 * 호스트 (sim-pm-api) 의 pino 기반 createLogger("sim-pm-api.assignment") 를
 * sim-domain-slice-kit 의 LoggerPort 로 감싼다. SLICE_LOGGER_PORT 토큰에 바인딩.
 *
 * - host logger 는 createLogger 결과 (pino) — HostLoggerLike 와 호환.
 * - kit 어댑터가 모든 emit 시점에 SliceLogContext 표준 필드를 logger.child(ctx)
 *   로 강제한다.
 */
export function createAssignmentLogger(): LoggerPort {
  const host = createLogger('sim-pm-api.assignment') as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
