// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import {
  createDefaultLoggerAdapter,
  type LoggerPort,
  type HostLoggerLike,
} from '@qa-sdk/sim-domain-slice-kit';
import { createLogger } from '../../../../lib/logger.js';

/**
 * Notification 슬라이스 LoggerPort 어댑터.
 *
 * 호스트 (sim-notification-api) 의 pino 기반 createLogger 를 LoggerPort 로 감싼다.
 */
export function createNotificationLogger(): LoggerPort {
  const host = createLogger('sim-notification-api.notification') as unknown as HostLoggerLike;
  return createDefaultLoggerAdapter(host);
}
